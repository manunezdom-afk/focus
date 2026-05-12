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

    /// Verbos que implican una **acción puntual** y se tratan como
    /// recordatorio (sin duración + notificación si toggle activo)
    /// aunque el usuario no haya dicho "acuérdame".
    ///
    /// Dos familias:
    ///   - **Despertar / levantar / amanecer**: momento de inicio del día.
    ///   - **Comidas** (comer, cenar, almorzar, desayunar, merendar, once):
    ///     "comer a las 7" es un evento puntual ("voy a comer a esa hora"),
    ///     no un bloque de 1 hora que el usuario quiera reservar. La
    ///     duración real es variable y el usuario rara vez la specifica;
    ///     mostrarlo como punto con notificación es más útil que un rango
    ///     inventado. Si el usuario quiere bloquear "almuerzo con Pedro de
    ///     1 a 3" puede usar "de N a M" y se respeta el endTime explícito.
    private static let punctualVerbPattern: String =
        #"\b(despertar(me|te|se|nos|los)?|despertame|despertarnos|despierto|despierta|levantar(me|te|se|nos|los)?|levantame|levantarnos|levanto|levanta|amanecer|amanezca|amanezco|comer|comerme|comida|cenar|cena|cenamos|almorzar|almuerzo|almorzamos|desayunar|desayuno|desayunamos|merendar|merienda|tomar\s+once)\b"#

    /// True cuando el texto contiene un verbo puntual (despertar/levantar/
    /// amanecer/comer/cenar/almorzar/desayunar/merendar). Estos verbos
    /// describen un momento, no un intervalo — se tratan como recordatorios
    /// para que: (a) no aparezcan con rango falso en el calendario,
    /// (b) disparen notificación si el toggle de recordatorios está activo.
    static func impliesPunctualReminder(in userText: String) -> Bool {
        return userText.range(
            of: punctualVerbPattern,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
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
            // Horas en dígitos.
            #"\ba la?s? \d{1,2}(:\d{2})?\s*(am|pm|hrs?|de la (mañana|manana|tarde|noche))?\b"#,
            #"\b\d{1,2}:\d{2}\b"#,
            #"\btipo (las? )?\d{1,2}(:\d{2})?\b"#,
            #"\bcomo a la?s? \d{1,2}(:\d{2})?\b"#,
            #"\b(a eso de|cerca de|alrededor de|por) la?s? \d{1,2}(:\d{2})?\b"#,
            // Horas en PALABRAS — "a las tres", "a la una", "a las tres y
            // media", "a las tres y cuarto", "tres y treinta", "tipo cuatro",
            // "como a las seis de la tarde". Sin este patrón el cleanTitle
            // dejaba "Ir a buscar a mi hermano a las tres" intacto y el step
            // 7 (artículos+nombres propios) capitalizaba "tres" → "a Tres".
            #"\b(a la?s?|tipo (las? )?|como a la?s?|a eso de la?s?|cerca de la?s?|alrededor de la?s?)\s+(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(\s+y\s+(media|cuarto|diez|quince|veinte|veinticinco|treinta))?(\s+(treinta|quince))?(\s+de la (mañana|manana|tarde|noche))?\b"#,
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

        // 3a. Strip destinos educacionales trailing tipo "para la universidad".
        //     "salir de mi casa a las 8 para la universidad" → tras strip
        //     temporal queda "salir de mi casa para la universidad" — el
        //     destino es contexto, no parte del título visible. Solo cuando
        //     la frase ESTÁ DOMINADA por un verbo de desplazamiento ("salir",
        //     "ir", "voy") + "para/a la X" donde X es ámbito educacional.
        //     No tocar "para el examen" / "para mi mamá" (no son destinos
        //     físicos, son objetivos personales).
        let lowerForDest = result.lowercased()
        let hasMoveVerb = lowerForDest.range(
            of: #"\b(salir|salgo|ir|voy|vamos|me voy|me salgo|entrar)\b"#,
            options: .regularExpression
        ) != nil
        if hasMoveVerb {
            // Artículo / posesivo opcional — la normalización previa puede haber
            // capitalizado "la universidad" → "Universidad" dejando "para
            // Universidad" sin artículo, pero también puede llegar tal cual.
            let destinationPatterns: [String] = [
                #"\s+para\s+(?:(?:la|el|las|los|mi|tu|su)\s+)?(?:universidad|colegio|escuela|clase|clases|facultad|liceo|preescolar|gimnasio|gym)\b"#,
                #"\s+a\s+(?:(?:la|el|las|los|mi|tu|su)\s+)?(?:universidad|colegio|escuela|facultad|liceo|preescolar|gimnasio|gym)\b"#
            ]
            for pattern in destinationPatterns {
                result = result.replacingOccurrences(
                    of: pattern,
                    with: " ",
                    options: [.regularExpression, .caseInsensitive]
                )
            }
        }

        // 3b. Strip frases de "X minutos antes" / "media hora antes" /
        //     "una hora antes" / "cinco min antes" — son metadata de
        //     notificación, no parte del título.
        let offsetPatterns: [String] = [
            #"\b(con|y)?\s*(acu(é|e)rdame|recu(é|e)rdame|av(í|i)same|recordame|recu(é|e)rdate|acu(é|e)rdate)\s+\d{1,3}\s+(min|minutos?|h|hs|hrs?|horas?)\s+antes\b"#,
            #"\b(con|y)?\s*(acu(é|e)rdame|recu(é|e)rdame|av(í|i)same|recordame|recu(é|e)rdate|acu(é|e)rdate)\s+(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|media|medio)\s+(min|minutos?|h|hs|hrs?|horas?)\s+antes\b"#,
            #"\b\d{1,3}\s+(min|minutos?|h|hs|hrs?|horas?)\s+antes\b"#,
            #"\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|media|medio)\s+(min|minutos?|h|hs|hrs?|horas?)\s+antes\b"#
        ]
        for pattern in offsetPatterns {
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
    /// Comportamiento:
    /// 1. CON artículo definido ("a la Agustina") → consume artículo,
    ///    capitaliza noun y devuelve "Buscar a Agustina" (idiomático: "la X"
    ///    en español familiar es nombre propio, decir "Ir a" resulta
    ///    redundante).
    /// 2. SIN artículo definido (ej. "a mi hermano", "pan", "a Juan") → NO
    ///    acortamos. Devolvemos el input tal cual para que "Ir a buscar a
    ///    mi hermano" se conserve. Antes lo cortábamos a "Buscar a mi
    ///    hermano" que sonaba seco.
    private static func stripVerboseGoVerb(_ input: String, verb: String) -> String {
        let pattern = "^\\s*\(NSRegularExpression.escapedPattern(for: verb))\\s+a\\s+(la|el|los|las)\\s+"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return input
        }
        let ns = input as NSString
        guard let match = regex.firstMatch(in: input, range: NSRange(location: 0, length: ns.length)) else {
            // No matched "verb a (la|el|los|las)" → no shortening. Mantener
            // verbo original. Caller seguirá con su limpieza normal.
            return input
        }
        // hadArticle = true. Capitalize primera palabra después del artículo.
        var rest = ns.substring(from: match.range.length)
        if let firstChar = rest.first, firstChar.isLowercase {
            rest = firstChar.uppercased() + rest.dropFirst()
        }
        return "Buscar a " + rest
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

    // MARK: - Reminder offsets ("X minutos antes")

    /// Extrae los minutos de offset que el usuario dijo en frases tipo:
    ///   - "acuérdame 5 minutos antes" → 5
    ///   - "recuérdame cinco min antes" → 5
    ///   - "avísame media hora antes" → 30
    ///   - "una hora antes" → 60
    ///   - "10 min antes" → 10
    ///
    /// Devuelve `nil` si no encuentra patrón explícito. Limita el rango a
    /// [1, 24*60] minutos para evitar offsets absurdos. Si el usuario dice
    /// varias frases, se queda con la primera (no soportamos múltiples
    /// avisos por ahora).
    static func extractReminderOffset(from text: String) -> Int? {
        let lower = text.lowercased()

        // 1. Patrón numérico: "5 minutos antes", "10 min antes", "2 horas antes"
        let numericPattern = #"(\d{1,3})\s+(min|minutos?|h|hs|hrs?|horas?)\s+antes\b"#
        if let regex = try? NSRegularExpression(pattern: numericPattern, options: [.caseInsensitive]) {
            let ns = lower as NSString
            if let match = regex.firstMatch(in: lower, range: NSRange(location: 0, length: ns.length)),
               match.numberOfRanges >= 3 {
                let valueStr = ns.substring(with: match.range(at: 1))
                let unit = ns.substring(with: match.range(at: 2))
                if let value = Int(valueStr) {
                    let mins = unit.hasPrefix("h") ? value * 60 : value
                    if mins >= 1 && mins <= 24 * 60 { return mins }
                }
            }
        }

        // 2. Patrón con número escrito: "media hora antes", "cinco minutos antes",
        //    "una hora antes", "quince min antes".
        let wordToNumber: [String: Int] = [
            "un": 1, "una": 1,
            "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
            "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
            "once": 11, "doce": 12, "quince": 15, "veinte": 20, "treinta": 30,
            "media": 30, "medio": 30
        ]
        let wordPattern = #"(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|media|medio)\s+(min|minutos?|h|hs|hrs?|horas?)\s+antes\b"#
        if let regex = try? NSRegularExpression(pattern: wordPattern, options: [.caseInsensitive]) {
            let ns = lower as NSString
            if let match = regex.firstMatch(in: lower, range: NSRange(location: 0, length: ns.length)),
               match.numberOfRanges >= 3 {
                let word = ns.substring(with: match.range(at: 1))
                let unit = ns.substring(with: match.range(at: 2))
                if let value = wordToNumber[word] {
                    // Caso especial: "media hora" / "medio hora" = 30 min, no 30 horas.
                    let isHalfHour = (word == "media" || word == "medio")
                    let mins: Int
                    if isHalfHour {
                        mins = 30
                    } else {
                        mins = unit.hasPrefix("h") ? value * 60 : value
                    }
                    if mins >= 1 && mins <= 24 * 60 { return mins }
                }
            }
        }

        return nil
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
