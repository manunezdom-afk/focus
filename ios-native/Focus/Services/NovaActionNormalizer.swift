import Foundation

/// Capa única de normalización de acciones de Nova. Tanto el backend
/// (`applyBackendActions`) como el fallback local (`applyLocalNovaIntent`)
/// pasan por acá antes de modificar el store.
///
/// Su trabajo:
///   1. **Limpiar el título** — quitar triggers tipo "acuérdame", "tipo 3",
///      "en 20", "recuérdame", fillers, fechas que se colaron al texto.
///   2. **Decidir si es recordatorio** — escanea el `userText` original
///      por triggers explícitos ("acuérdame", "recuérdame", "avísame",
///      "que no se me olvide", "no te olvides", "acuérdate") sin importar
///      lo que dijo el backend.
///   3. **Calcular endTime** — `nil` cuando es recordatorio o cuando el
///      backend no devolvió endTime explícito → UI muestra como punto, no
///      como rango falso.
///   4. **Decidir si programar notificación** — `true` solo cuando hay
///      hora futura + es recordatorio + toggle global activo.
///
/// Es una capa estática, sin estado, sin dependencias de SwiftUI. Solo
/// funciones puras de validación / sanitización.
enum NovaActionNormalizer {

    // MARK: - Triggers explícitos de recordatorio

    /// Triggers que, si aparecen en el `userText` original, fuerzan a que
    /// la acción se trate como recordatorio puntual aunque el backend o el
    /// parser local hayan dicho otra cosa.
    ///
    /// Estos triggers cubren toda la familia común en español chileno/latino.
    private static let reminderTriggers: [String] = [
        "acuérdame",
        "acuerdame",
        "acuérdate",
        "acuerdate",
        "acuérdalo",
        "acuerdalo",
        "acordarme",
        "recuérdame",
        "recuerdame",
        "recordame",
        "recordarme",
        "avísame",
        "avisame",
        "que no se me olvide",
        "no te olvides",
        "no olvides",
        "no me dejes olvidar"
    ]

    /// True cuando `userText` contiene cualquier trigger explícito de
    /// recordatorio. Case-insensitive y robusto a acentos faltantes.
    static func isReminderTrigger(in userText: String) -> Bool {
        let lower = userText.lowercased()
        return reminderTriggers.contains { lower.contains($0) }
    }

    // MARK: - Limpieza de título

    /// Quita ruido del título — triggers de recordatorio, marcadores
    /// temporales sueltos, fillers, prefijos "Recordatorio:" duplicados.
    /// Centraliza la limpieza que antes vivía fragmentada en `cleanTaskTitle`,
    /// `stripReminderTriggers`, `cleanupTitle`.
    ///
    /// Pasos:
    ///   1. Strip "Recordatorio:" prefix (lo manejamos via isReminder flag).
    ///   2. Strip triggers de recordatorio embebidos.
    ///   3. Strip marcadores temporales sueltos ("tipo 3", "a las 20",
    ///      "en 20 minutos", "mañana", "hoy", "el jueves").
    ///   4. Strip fillers ("porfa", "oye", "dale").
    ///   5. Strip "ir a buscar" → "Buscar a" (verbo redundante).
    ///   6. Collapse whitespace + capitalize first noun.
    ///
    /// Devuelve "" si el resultado queda vacío — el caller decide si pide
    /// clarificación.
    static func cleanTitle(_ raw: String) -> String {
        guard !raw.isEmpty else { return "" }
        var result = raw

        // 1. Strip prefix "Recordatorio: " (case-insensitive)
        if let range = result.range(of: #"^\s*recordatorio[:\s-]+"#,
                                     options: [.regularExpression, .caseInsensitive]) {
            result.removeSubrange(range)
        }

        // 2. Strip reminder triggers embebidos.
        for trigger in reminderTriggers {
            result = result.replacingOccurrences(
                of: "\\b" + NSRegularExpression.escapedPattern(for: trigger) + "\\b",
                with: " ",
                options: [.regularExpression, .caseInsensitive]
            )
        }

        // 3. Strip marcadores temporales sueltos.
        let temporalPatterns: [String] = [
            // Horas
            #"\ba la?s? \d{1,2}(:\d{2})?\s*(am|pm|hrs?|de la (mañana|manana|tarde|noche))?\b"#,
            #"\b\d{1,2}:\d{2}\b"#,
            #"\btipo (las? )?\d{1,2}(:\d{2})?\b"#,
            #"\bcomo a la?s? \d{1,2}(:\d{2})?\b"#,
            #"\b(a eso de|cerca de|alrededor de|por) la?s? \d{1,2}(:\d{2})?\b"#,
            // Relativos
            #"\ben\s+\d{1,3}\s+(min|minutos?|h|hs|hrs?|horas?)\b"#,
            #"\ben\s+\d{1,2}\b"#,
            #"\b\d{1,2}\s*hrs?\b"#,
            #"\b\d{1,2}\s*hs\b"#,
            // Días
            #"\bhoy\b"#,
            #"\bmañana\b"#,
            #"\bmanana\b"#,
            #"\bpasado mañana\b"#,
            #"\bpasado manana\b"#,
            #"\besta (tarde|noche|mañana|manana)\b"#,
            #"\ben la (tarde|noche|mañana|manana)\b"#,
            #"\bal mediod(í|i)a\b"#,
            #"\bel (lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b"#,
            #"\bdespu(é|e)s de(l)? (almuerzo|almorzar|trabajo)\b"#,
            #"\bal final del d(í|i)a\b"#,
            #"\bal amanecer\b"#
        ]
        for pattern in temporalPatterns {
            result = result.replacingOccurrences(
                of: pattern,
                with: " ",
                options: [.regularExpression, .caseInsensitive]
            )
        }

        // 4. Strip fillers comunes.
        let fillerPatterns: [String] = [
            #"\bporfa(vor)?\b"#,
            #"\bpor favor\b"#,
            #"\boye\b"#,
            #"\bhey\b"#,
            #"\bdale\b"#,
            #"\bche\b"#
        ]
        for pattern in fillerPatterns {
            result = result.replacingOccurrences(
                of: pattern,
                with: " ",
                options: [.regularExpression, .caseInsensitive]
            )
        }

        // 5. "ir a buscar [a la|a el|a los|a las] X" → "Buscar a X".
        //    Si HABÍA artículo, capitalizamos X (es nombre propio en español
        //    cuando se nombra con artículo "la Agustina" = nombre familiar).
        //    Si NO había artículo, dejamos X como está ("a mi hermano").
        result = stripVerboseGoVerb(result, verb: "ir a buscar")

        // 6. "salir a buscar a X" → "Buscar a X"
        result = stripVerboseGoVerb(result, verb: "salir a buscar")

        // 7. Quitar artículos antes de nombres propios: "a la agustina"
        //    → "a Agustina". Capitaliza el nombre propio.
        if let regex = try? NSRegularExpression(
            pattern: #"\b(a|con|de|para|por) (la|las|el|los) ([a-záéíóúñ]+)\b"#,
            options: [.caseInsensitive]
        ) {
            let ns = result as NSString
            let matches = regex.matches(in: result, range: NSRange(location: 0, length: ns.length))
            for match in matches.reversed() {
                guard match.numberOfRanges >= 4 else { continue }
                let prep = ns.substring(with: match.range(at: 1))
                let noun = ns.substring(with: match.range(at: 3))
                let cap = noun.prefix(1).uppercased() + noun.dropFirst()
                result = (result as NSString)
                    .replacingCharacters(in: match.range, with: "\(prep) \(cap)")
            }
        }

        // 8. Collapse whitespace + trim puntuación.
        result = result
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        result = result.trimmingCharacters(in: CharacterSet(charactersIn: ".,;:!?¿¡"))
            .trimmingCharacters(in: .whitespacesAndNewlines)

        // 9. Capitalize primera letra del título si no lo está.
        guard let firstChar = result.first else { return "" }
        if firstChar.isLowercase {
            result = firstChar.uppercased() + result.dropFirst()
        }

        return result
    }

    /// Strip "ir a buscar [a la/a el/a los/a las] X" / "salir a buscar ..."
    /// → "Buscar a X". Tres caminos:
    /// 1. Con artículo ("a la agustina") → consume artículo + capitaliza
    ///    noun (uso natural latino: "la Agustina" = nombre propio).
    /// 2. Sin artículo y rest empieza con "a " (preposición original del
    ///    usuario, ej. "a mi hermano") → preserva como "Buscar a mi
    ///    hermano" sin duplicar "a".
    /// 3. Sin artículo y rest no empieza con "a " → prepend "Buscar a ".
    private static func stripVerboseGoVerb(_ input: String, verb: String) -> String {
        let pattern = "^\\s*\(NSRegularExpression.escapedPattern(for: verb))\\s+(?:a\\s+(la|el|los|las)\\s+)?"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return input
        }
        let ns = input as NSString
        guard let match = regex.firstMatch(in: input, range: NSRange(location: 0, length: ns.length)) else {
            return input
        }
        let hadArticle = match.range(at: 1).location != NSNotFound
        var rest = ns.substring(from: match.range.length)

        if hadArticle {
            // Capitalize primera palabra — es nombre propio.
            if let firstChar = rest.first, firstChar.isLowercase {
                rest = firstChar.uppercased() + rest.dropFirst()
            }
            return "Buscar a " + rest
        } else if rest.lowercased().hasPrefix("a ") {
            // El usuario ya escribió "a mi hermano" — no duplicamos la "a".
            return "Buscar " + rest
        } else {
            return "Buscar a " + rest
        }
    }

    // MARK: - endTime rules

    /// Decide qué endTime guardar en el FocusEvent según las reglas del producto:
    /// - Si `isReminder` es true → siempre `nil` visible (UI muestra como punto).
    /// - Si `hasExplicitEndTime` (el usuario dijo "de X a Y" o "hasta Z") y el
    ///   end provisto es > start → respetar.
    /// - Sino → `nil` (la UI lo trata como punto inferido).
    ///
    /// Importante: NO devolvemos `start + 5min` artificial — eso causaba que
    /// recordatorios vencidos se vieran como "próximos" hasta 5 min después.
    /// El store puede internamente padear si necesita, pero la decisión
    /// visible va por acá.
    static func resolveEndTime(
        startTime: Date,
        providedEndTime: Date?,
        hasExplicitEndTime: Bool,
        isReminder: Bool
    ) -> (endTime: Date?, inferredDuration: Bool) {
        if isReminder {
            return (nil, false)  // recordatorio puntual
        }
        if hasExplicitEndTime, let end = providedEndTime, end > startTime {
            return (end, false)
        }
        return (nil, true)  // duración inferida, mostrar como punto
    }

    // MARK: - Validation

    /// Resultado de validar una acción "create" antes de aplicarla al store.
    struct ValidationResult {
        let isValid: Bool
        let missingFields: Set<MissingField>
        let suggestedQuestion: String?
    }

    enum MissingField: String, Hashable {
        case title
        case date
        case time
    }

    /// Valida que una acción "createEvent" tenga lo mínimo para guardarse.
    /// Si falta algo, devuelve `isValid: false` + una pregunta concreta
    /// que el caller puede usar para pedir aclaración.
    static func validateCreateEvent(
        title: String,
        startTime: Date?
    ) -> ValidationResult {
        var missing: Set<MissingField> = []
        if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            missing.insert(.title)
        }
        if startTime == nil {
            missing.insert(.date)
            missing.insert(.time)
        }
        guard missing.isEmpty else {
            let question: String
            if missing.contains(.title) {
                question = "¿Qué quieres que agende?"
            } else if missing.contains(.date) && missing.contains(.time) {
                question = "¿Para qué día y a qué hora?"
            } else if missing.contains(.time) {
                question = "¿A qué hora?"
            } else {
                question = "¿Cuándo?"
            }
            return ValidationResult(isValid: false, missingFields: missing, suggestedQuestion: question)
        }
        return ValidationResult(isValid: true, missingFields: [], suggestedQuestion: nil)
    }

    // MARK: - Notification scheduling rule

    /// Decide si debe programarse una notificación local. Cuatro condiciones:
    ///   1. Es recordatorio (`isReminder == true`).
    ///   2. La hora todavía es futura.
    ///   3. El toggle global "Recordatorios" está ON.
    ///
    /// El caller también debe chequear permiso de iOS — eso requiere async
    /// y se hace fuera de esta capa pura.
    static func shouldScheduleNotification(
        isReminder: Bool,
        startTime: Date,
        remindersEnabledInSettings: Bool
    ) -> Bool {
        guard isReminder else { return false }
        guard startTime > Date() else { return false }
        guard remindersEnabledInSettings else { return false }
        return true
    }

    // MARK: - Duplicate detection (anti-basura)

    /// True si ya hay un evento "casi igual" en la lista — mismo título
    /// (case-insensitive, ignorando acentos básicos) + mismo día +
    /// hora dentro de ±10 min. Usado para evitar duplicar cuando el
    /// usuario repite un comando.
    static func isLikelyDuplicate(
        title: String,
        startTime: Date,
        existingEvents: [FocusEvent]
    ) -> Bool {
        let lowerTitle = title.lowercased().folding(options: .diacriticInsensitive, locale: .current)
        let cal = Calendar.current
        return existingEvents.contains { ev in
            let evTitleLower = ev.title.lowercased().folding(options: .diacriticInsensitive, locale: .current)
            guard evTitleLower == lowerTitle else { return false }
            guard cal.isDate(ev.startTime, inSameDayAs: startTime) else { return false }
            let diffMinutes = abs(ev.startTime.timeIntervalSince(startTime)) / 60
            return diffMinutes <= 10
        }
    }
}
