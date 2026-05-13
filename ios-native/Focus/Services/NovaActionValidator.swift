import Foundation

/// Validador post-IA: corre sobre las `BackendAction` que devuelve Haiku/
/// Sonnet ANTES de aplicarlas al store. Captura los patrones de "ruido"
/// más comunes que rompían el flujo del usuario en beta:
///
/// 1. **Títulos concatenados** — "Salir a jugar fútbol que llevar la
///    pelota" (verbos de cláusulas distintas pegados).
/// 2. **Títulos con hora pegada** — "Comer a las 4" (la hora ya va en
///    `time`, no debe aparecer en `title`).
/// 3. **Categoría reunión sin trigger** — el modelo a veces emite
///    icon="groups" para cualquier evento social. Reunión solo si el
///    usuario dijo literalmente reunión / junta / meet / call / 1:1 /
///    standup / demo.
/// 4. **Títulos vacíos o demasiado largos** — síntoma de prompt failure.
///
/// Política:
/// - Si el validador rechaza **alguna** acción → NO aplica ninguna y
///   pide al usuario revisar. Aplicar a medias es peor que pedir
///   confirmación: el usuario puede creer que ejecutó todo cuando
///   en realidad faltan piezas.
/// - Si todas las acciones pasan pero hay un *sanitize* leve (downgrade
///   de icon "groups" a "event" sin trigger de reunión), las acciones
///   se aplican con la corrección.
///
/// El validador NO intenta corregir títulos sucios — esos casos viene
/// de mala estructuración del modelo y es más seguro preguntar que
/// adivinar.
enum NovaActionValidator {
    /// Resultado de validar una tanda de acciones del backend.
    struct Result {
        /// Acciones consideradas seguras para aplicar al store. Vacío si
        /// alguna acción fue rechazada — en ese caso, el caller debe
        /// mostrar `suggestedQuestion` y NO aplicar nada.
        let safeActions: [BackendAction]
        /// Acciones que se descartaron por riesgo, con la razón legible.
        let rejected: [(action: BackendAction, reason: String)]
        /// True si el caller debe tratar la respuesta como pregunta (no
        /// ejecutar) en vez de éxito.
        let shouldAsk: Bool
        /// Mensaje humano sugerido para la pregunta. nil si no se necesita.
        let suggestedQuestion: String?
    }

    /// Punto de entrada. Decide qué acciones son seguras para aplicar.
    /// `userText` es el texto original del usuario (lo usamos para
    /// validar la presencia de triggers como "reunión").
    static func validate(
        actions: [BackendAction],
        userText: String
    ) -> Result {
        let lower = userText.lowercased()
        var safe: [BackendAction] = []
        var rejected: [(BackendAction, String)] = []

        for action in actions {
            switch action {
            case .addEvent(let evt):
                if let reason = risky(event: evt, userTextLower: lower) {
                    rejected.append((action, reason))
                } else {
                    safe.append(.addEvent(sanitized(evt, userTextLower: lower)))
                }

            case .addRecurringEvent(let evt, let recurrence):
                if let reason = risky(event: evt, userTextLower: lower) {
                    rejected.append((action, reason))
                } else {
                    safe.append(.addRecurringEvent(
                        sanitized(evt, userTextLower: lower),
                        recurrence
                    ))
                }

            case .addTask(let task):
                if let reason = riskyTaskTitle(task.label) {
                    rejected.append((action, reason))
                } else {
                    safe.append(action)
                }

            case .editEvent, .deleteEvent, .toggleTask, .deleteTask,
                 .remember, .unsupported:
                // Acciones de mantenimiento/edición — el riesgo es bajo,
                // pasan tal cual. Si edit_event tuviera un updates.title
                // sucio, lo dejamos pasar; el caso edge se ve raro pero
                // no rompe el calendario.
                safe.append(action)
            }
        }

        let hasRejections = !rejected.isEmpty
        return Result(
            // Política conservadora: si hay rechazo, NO aplicar nada.
            // Aplicar solo las "buenas" puede dejar al usuario con un
            // estado parcial confuso ("agendaste 2 de 3").
            safeActions: hasRejections ? [] : safe,
            rejected: rejected,
            shouldAsk: hasRejections,
            suggestedQuestion: hasRejections
                ? "Te entendí varias cosas, pero algo no me cuadró del todo. ¿Las revisamos juntos antes de guardar?"
                : nil
        )
    }

    // MARK: - Validaciones de eventos

    /// Devuelve la razón (legible) si el evento es "sospechoso" y debería
    /// pedir confirmación. nil si es seguro.
    ///
    /// Nota: la categoría "groups" sin trigger NO se rechaza acá — se
    /// arregla silenciosamente en `sanitized()` (downgrade a "event").
    /// Rechazar bloquearía toda la tanda por un detalle de clasificación
    /// que el cliente puede corregir sin involucrar al usuario.
    private static func risky(event: BackendEventCreate, userTextLower lower: String) -> String? {
        if let r = riskyEventTitle(event.title) { return r }
        return nil
    }

    /// Reglas duras para títulos de evento.
    private static func riskyEventTitle(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "título vacío" }
        let lower = trimmed.lowercased()

        // Patrón A — verbos encadenados: "X que (verb)" / "X y (verb)" /
        // "X luego (de) (verb)". Solo capturamos verbos comunes de
        // acción del calendario para no falsos-positivos en títulos
        // legítimos como "Almuerzo con Juan y Pedro".
        let chainVerbs = "(llevar|volver|comer|cenar|almorzar|salir|ir|hacer|tomar|traer|estudiar|trabajar|jugar|leer)"
        let concatPatterns = [
            "\\bque \(chainVerbs)\\b",
            "\\bluego (?:de )?\(chainVerbs)\\b",
            "\\bdespu(?:é|e)s (?:de )?\(chainVerbs)\\b",
        ]
        for pattern in concatPatterns {
            if lower.range(of: pattern, options: .regularExpression) != nil {
                return "título con verbo encadenado de otra acción"
            }
        }

        // Patrón B — hora pegada en el título. La hora va en `time`,
        // nunca en `title`.
        if lower.range(of: #"\b\d{1,2}:\d{2}\b"#, options: .regularExpression) != nil {
            return "título tiene una hora pegada (la hora va en time, no en title)"
        }
        if lower.range(of: #"\ba la(?:s)? \d{1,2}\b"#, options: .regularExpression) != nil {
            return "título contiene 'a las N'"
        }
        if lower.range(of: #"\ben \d{1,3}\s*(min|hora)"#, options: .regularExpression) != nil {
            return "título contiene 'en N min/hora'"
        }

        // Patrón C — título demasiado largo. Casi siempre signo de
        // concatenación de varias cláusulas en un solo string.
        if trimmed.count > 60 {
            return "título demasiado largo (\(trimmed.count) chars)"
        }

        return nil
    }

    /// Tareas (sin hora) son más permisivas — la "y" entre objetos es
    /// común ("comprar pan y leche"). Solo validamos vacío y longitud.
    private static func riskyTaskTitle(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "tarea vacía" }
        if trimmed.count > 80 {
            return "tarea demasiado larga"
        }
        return nil
    }

    // MARK: - Sanitization (corrección leve, no bloqueante)

    /// Si el evento es seguro pero algún detalle es sospechoso, devolvemos
    /// una copia con el detalle corregido. Por ahora solo: icon "groups"
    /// sin trigger → cambia a "event" (genérico). El título se respeta.
    private static func sanitized(_ evt: BackendEventCreate, userTextLower lower: String) -> BackendEventCreate {
        var iconOut = evt.icon
        if let icon = evt.icon, icon.lowercased() == "groups",
           !mentionsReunionTrigger(lower) {
            iconOut = "event"
        }
        return BackendEventCreate(
            title: evt.title,
            timeString: evt.timeString,
            endTimeString: evt.endTimeString,
            dateString: evt.dateString,
            section: evt.section,
            icon: iconOut,
            reminderOffsets: evt.reminderOffsets,
            location: evt.location,
            notes: evt.notes
        )
    }

    // MARK: - Helpers

    /// True si el texto del usuario contiene alguna palabra que justifica
    /// categorizar como "reunión".
    static func mentionsReunionTrigger(_ lower: String) -> Bool {
        let triggers = [
            "reunión", "reunion", "junta", "juntada",
            "meet ", "meeting", "call ", " call",
            "llamada", "videollamada",
            "1:1", "1on1", "uno a uno",
            "stand up", "standup", "stand-up", "daily",
            "demo", "review", "retro",
        ]
        for t in triggers where lower.contains(t) { return true }
        return false
    }
}

#if DEBUG
/// Tests del validador. Se invocan desde `NovaActionNormalizerTests.runAll`.
enum NovaActionValidatorTests {
    @discardableResult
    static func runAll(into failures: inout [String]) -> Int {
        let countBefore = failures.count

        // 1. Acción limpia pasa.
        let cleanEvent = mockEvent(title: "Ir a buscar a mi hermano", icon: "event")
        let r1 = NovaActionValidator.validate(
            actions: [.addEvent(cleanEvent)],
            userText: "necesito ir a buscar a mi hermano a las tres"
        )
        check(label: "validator: acción limpia pasa",
              actual: r1.safeActions.count, expected: 1, failures: &failures)
        check(label: "validator: clean → shouldAsk false",
              actual: r1.shouldAsk, expected: false, failures: &failures)

        // 2. Título concatenado se rechaza.
        let badEvent = mockEvent(title: "Salir a jugar fútbol que llevar la pelota", icon: "event")
        let r2 = NovaActionValidator.validate(
            actions: [.addEvent(badEvent)],
            userText: "salir a jugar fútbol y llevar la pelota a las 11"
        )
        check(label: "validator: concat 'que llevar' rechazado",
              actual: r2.safeActions.count, expected: 0, failures: &failures)
        check(label: "validator: concat → shouldAsk true",
              actual: r2.shouldAsk, expected: true, failures: &failures)

        // 3. Hora pegada al título se rechaza.
        let timeInTitle = mockEvent(title: "Comer a las 4", icon: "restaurant")
        let r3 = NovaActionValidator.validate(
            actions: [.addEvent(timeInTitle)],
            userText: "tengo que comer a las 4"
        )
        check(label: "validator: 'a las 4' pegado rechazado",
              actual: r3.shouldAsk, expected: true, failures: &failures)

        // 4. Categoría reunión sin trigger → sanitize a "event".
        let fakeReunion = mockEvent(title: "Comer con papá", icon: "groups")
        let r4 = NovaActionValidator.validate(
            actions: [.addEvent(fakeReunion)],
            userText: "comer con papá a las 7"
        )
        check(label: "validator: groups sin trigger sanitizado",
              actual: r4.safeActions.count, expected: 1, failures: &failures)
        if case .addEvent(let evt) = r4.safeActions.first {
            check(label: "validator: icon downgraded a 'event'",
                  actual: evt.icon, expected: "event" as String?, failures: &failures)
        }

        // 5. Categoría reunión CON trigger se respeta.
        let realReunion = mockEvent(title: "Reunión con Juan", icon: "groups")
        let r5 = NovaActionValidator.validate(
            actions: [.addEvent(realReunion)],
            userText: "reunión con Juan mañana a las 5"
        )
        if case .addEvent(let evt) = r5.safeActions.first {
            check(label: "validator: groups con 'reunión' se conserva",
                  actual: evt.icon, expected: "groups" as String?, failures: &failures)
        }

        // 6. Título demasiado largo se rechaza.
        let longTitle = String(repeating: "x", count: 65)
        let huge = mockEvent(title: longTitle, icon: "event")
        let r6 = NovaActionValidator.validate(
            actions: [.addEvent(huge)],
            userText: "x"
        )
        check(label: "validator: título >60 chars rechazado",
              actual: r6.shouldAsk, expected: true, failures: &failures)

        // 7. Tarea pasa con "y" entre objetos.
        let breadAndMilk = BackendTaskCreate(
            label: "Comprar pan y leche", priority: nil, category: nil,
            linkedEventId: nil, parentTaskId: nil
        )
        let r7 = NovaActionValidator.validate(
            actions: [.addTask(breadAndMilk)],
            userText: "comprar pan y leche"
        )
        check(label: "validator: 'pan y leche' tarea pasa",
              actual: r7.safeActions.count, expected: 1, failures: &failures)

        // 8. Mix: una acción mala bloquea TODO el lote.
        let mixActions: [BackendAction] = [
            .addEvent(mockEvent(title: "Ir a jugar fútbol", icon: "event")),
            .addEvent(mockEvent(title: "Salir que llevar pelota", icon: "event")),
        ]
        let r8 = NovaActionValidator.validate(
            actions: mixActions,
            userText: "ir a jugar fútbol y llevar la pelota"
        )
        check(label: "validator: una mala bloquea las 2 buenas",
              actual: r8.safeActions.count, expected: 0, failures: &failures)
        check(label: "validator: mix → shouldAsk true",
              actual: r8.shouldAsk, expected: true, failures: &failures)

        return failures.count - countBefore
    }

    // MARK: - Helpers locales del test

    private static func mockEvent(
        title: String, icon: String?, time: String? = "3:00 PM"
    ) -> BackendEventCreate {
        BackendEventCreate(
            title: title,
            timeString: time,
            endTimeString: nil,
            dateString: nil,
            section: nil,
            icon: icon,
            reminderOffsets: nil,
            location: nil,
            notes: nil
        )
    }

    private static func check<T: Equatable>(
        label: String, actual: T, expected: T,
        failures: inout [String]
    ) {
        if actual != expected {
            let msg = "  ✗ \(label) — got \(actual), expected \(expected)"
            print(msg); failures.append(msg)
        }
    }
}
#endif
