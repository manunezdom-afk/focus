import SwiftUI
import Combine
import Foundation

/// Quick action que el usuario puede tocar en la pestaña Acciones de Nova.
/// Cubre el ciclo del día (planificar / agregar / revisar / cerrar) más el
/// flujo de calendario externo (importar / exportar — V1 informativo).
enum NovaQuickAction: String, CaseIterable, Identifiable {
    case organizar
    case crearTarea
    case crearEvento
    case revisarPendientes
    case prepararManana
    case cerrarDia
    case importarCalendario
    case exportarCalendario

    var id: String { rawValue }

    var label: String {
        switch self {
        case .organizar:          return "Organizar mi día"
        case .crearTarea:         return "Crear tarea"
        case .crearEvento:        return "Crear evento"
        case .revisarPendientes:  return "Revisar pendientes"
        case .prepararManana:     return "Preparar mañana"
        case .cerrarDia:          return "Cerrar el día"
        case .importarCalendario: return "Importar calendario"
        case .exportarCalendario: return "Exportar calendario"
        }
    }

    var subtitle: String {
        switch self {
        case .organizar:          return "Acomodo bloques de hoy con tus prioridades."
        case .crearTarea:         return "Anoto una tarea con prioridad y categoría."
        case .crearEvento:        return "Agendo un bloque o reunión en tu día."
        case .revisarPendientes:  return "Repaso lo que quedó sin horario o decisión."
        case .prepararManana:     return "Reviso lo que viene y dejo el día armado."
        case .cerrarDia:          return "Reviso lo hecho y limpio lo que no resolviste."
        case .importarCalendario: return "Traer eventos de Google, Apple o un .ics."
        case .exportarCalendario: return "Sacar tu agenda como .ics o a otro calendario."
        }
    }

    var symbol: String {
        switch self {
        case .organizar:          return "sparkles"
        case .crearTarea:         return "checkmark.circle"
        case .crearEvento:        return "calendar.badge.plus"
        case .revisarPendientes:  return "tray.full"
        case .prepararManana:     return "moon.stars"
        case .cerrarDia:          return "checkmark.seal"
        case .importarCalendario: return "square.and.arrow.down"
        case .exportarCalendario: return "square.and.arrow.up"
        }
    }

    var userText: String { label }

    var novaReply: String {
        switch self {
        case .organizar:
            return "Cuéntame qué quieres priorizar y revisamos tu día juntos."
        case .crearTarea:
            return "Dime qué tarea quieres crear y la agendo con prioridad y categoría. Ej: \"Entregar TP de Programación el viernes\"."
        case .crearEvento:
            return "Cuéntame qué evento, qué día y a qué hora. Puedes decirme \"acuérdame 10 minutos antes\" si quieres aviso."
        case .revisarPendientes:
            return "Cuéntame qué pendientes te están pesando hoy y los priorizamos."
        case .prepararManana:
            return "Cuéntame qué quieres dejar listo para mañana y armamos un plan corto."
        case .cerrarDia:
            return "Cuéntame cómo te fue hoy y revisamos qué dejar listo para mañana."
        case .importarCalendario:
            return "Puedo ayudarte a traer tus eventos desde Google Calendar, Apple Calendar o un archivo .ics. Cuando conectemos la integración, revisaré conflictos, tareas sin horario y bloques disponibles."
        case .exportarCalendario:
            return "Cuando conectemos la exportación, vas a poder mandar tu agenda como .ics o sincronizarla a Google/Apple Calendar. Por ahora solo guardamos local en tu iPhone."
        }
    }
}

// MARK: - Nova intents (estructurados, mock-friendly)

/// Hint de recurrencia detectada en el texto del usuario. Por ahora la app NO
/// soporta recurrencia nativa — solo se usa para que Nova responda con honestidad
/// ("la recurrencia queda para próxima versión") en vez de prometer y fallar.
enum RecurrenceHint: Hashable {
    case daily
    case weekly
    case weeklyOn(label: String)   // "los lunes", "los miércoles"
    case monthly
    case unspecified               // "recurrente" sin frecuencia explícita

    var label: String {
        switch self {
        case .daily:                return "todos los días"
        case .weekly:               return "cada semana"
        case .weeklyOn(let label):  return "todos \(label)"
        case .monthly:              return "cada mes"
        case .unspecified:          return "recurrente"
        }
    }
}

/// Lo que Nova entendió del mensaje del usuario. La interpretación es local
/// (sin IA real); cuando se conecte el backend, este enum se mantiene y solo
/// cambia el parser.
enum NovaIntent: Hashable {
    /// Crear tarea con título, opcional fecha límite, opcional recurrencia,
    /// opcional flag "acuérdame".
    case createTask(title: String, dueDate: Date?, recurrence: RecurrenceHint?, wantsReminder: Bool)
    /// Crear evento. `when` es opcional — si no lo extrajimos, Nova pide
    /// aclaración. `section` también opcional con default `.reunion`.
    /// `endTime` es no-nil solo cuando el usuario dio hora-fin explícita
    /// ("de 3 a 4", "hasta las 4", "por 1h"). Si es nil, el evento se
    /// muestra como punto en el tiempo.
    case createEvent(
        title: String,
        when: Date?,
        endTime: Date?,
        location: String?,
        section: EventSection?,
        wantsReminder: Bool
    )
    /// Corregir el último ítem creado (evento o tarea). Resuelto desde
    /// `NovaContext.lastEventId` / `lastTaskId`.
    case correctLastEvent(modifier: EventCorrection)
    /// Convertir el último evento en tarea (mismo título, sin hora).
    case convertLastToTask
    /// Borrar el último ítem creado (evento o tarea).
    case deleteLastItem
    /// Organizar el día → genera sugerencias en la Bandeja.
    case organizeDay
    /// Revisar tareas pendientes → resumen inline.
    case reviewPending
    /// Pregunta sobre cómo borrar ejemplos demo.
    case askAboutDemo
    /// Saludo / acuse simple. La respuesta es variada (no siempre la misma).
    case smallTalk(reply: String)
    /// Texto no entendible — pedimos una aclaración con razón específica.
    case clarify(reason: ClarifyReason)

    enum ClarifyReason: Hashable {
        case taskNeedsTitle
        case eventNeedsTitle
        case eventNeedsTime(title: String, partialDate: Date)
        case eventNeedsDateTime(title: String)
        case noContext                  // "agéndalo" sin contexto previo
        case unclear
    }
}

/// Modificador para `correctLastEvent`. Soporta cambios sin re-crear el ítem.
enum EventCorrection: Hashable {
    case shiftDays(offset: Int)            // "no, mañana" → +1; "no, ayer" → -1
    case setTime(hour: Int, minute: Int)   // "cámbialo a las 18"
    case setLocation(String)               // "en sala H013"
    case setTitle(String)                  // "era con Pedro" → cambia título
}

// MARK: - Contexto de sesión de Nova (memoria corta)

/// Memoria local de la última interacción con Nova. Permite resolver
/// referencias tipo "agéndalo como tarea recurrente" — "lo" remite al título
/// más reciente. NO se persiste en disco: vive solo en RAM durante la sesión.
struct NovaContext: Equatable {
    var lastInputText: String?
    var lastTitle: String?
    var lastDate: Date?
    var lastLocation: String?
    var lastSection: EventSection?
    var lastIntentKind: Kind?
    var lastEventId: UUID?
    var lastTaskId: UUID?
    /// Aclaración pendiente cuando Nova preguntó algo y la acción NO se llegó
    /// a ejecutar. El siguiente turno corto (ej. "a las 20", "en 20 minutos",
    /// "sí", "mañana") puede usarlo para completar la acción sin que el
    /// usuario tenga que repetir título/contexto. Auto-expira a los 10 min.
    var pendingClarification: PendingClarification?
    var updatedAt: Date = Date()

    enum Kind: Hashable {
        case task
        case event
    }

    var isFresh: Bool {
        // Contexto válido por 10 minutos. Después se trata como "sin contexto".
        Date().timeIntervalSince(updatedAt) < 600
    }

    /// Helper: pending solo es "vivo" si existe, no expiró y el contexto
    /// general es fresco. Lo usamos para decidir si resolver follow-ups.
    var pendingIsActive: Bool {
        guard let p = pendingClarification else { return false }
        return Date() < p.expiresAt && isFresh
    }
}

/// Aclaración pendiente: Nova preguntó algo y la acción no se ejecutó.
/// Persiste durante 10 minutos para que el usuario pueda responder corto
/// y completar la acción.
///
/// Ejemplo:
///   Usuario: "tengo parcial el jueves"
///   Nova:    "¿A qué hora?"  → save PendingClarification(kind=.event,
///            proposedTitle="Parcial", proposedDate=jueves,
///            missingFields=[.time])
///   Usuario: "a las 3"      → parse detecta pending, completa con time=15:00.
struct PendingClarification: Equatable {
    /// Mensaje original que originó la aclaración.
    var originalInput: String
    /// Tipo de acción que Nova quería crear (en su mejor interpretación).
    var kind: Kind
    /// Título limpio listo para usar (si Nova ya lo había extraído).
    var proposedTitle: String?
    /// Fecha tentativa (puede ser solo el día si falta la hora).
    var proposedDate: Date?
    /// Sección detectada por keywords del texto original.
    var proposedSection: EventSection?
    /// Ubicación si Nova la había extraído.
    var proposedLocation: String?
    /// `true` cuando el usuario dijo "acuérdame/recuérdame": la acción
    /// completada debe ser un recordatorio puntual, no un evento con rango.
    var wantsReminder: Bool
    /// Lista de campos que faltan completar para ejecutar la acción.
    var missingFields: Set<MissingField>
    /// La pregunta exacta que Nova hizo. Útil para debugging y UI.
    var questionAsked: String?
    /// Surface que originó la aclaración (inline Mi Día o chat).
    var source: Source
    /// Cuándo se creó.
    var createdAt: Date
    /// Auto-expiración: 10 minutos después de createdAt.
    var expiresAt: Date

    enum Kind: String, Hashable {
        case event
        case task
        case reminder
        /// Indeterminado: pedimos al usuario que aclare entre evento o tarea.
        case ambiguous
    }

    enum MissingField: String, Hashable {
        case title
        case date
        case time
        case duration
        case targetItem
        case actionType
    }

    enum Source: String, Hashable {
        case inlineMiDia
        case novaChat
    }

    init(
        originalInput: String,
        kind: Kind,
        proposedTitle: String? = nil,
        proposedDate: Date? = nil,
        proposedSection: EventSection? = nil,
        proposedLocation: String? = nil,
        wantsReminder: Bool = false,
        missingFields: Set<MissingField> = [],
        questionAsked: String? = nil,
        source: Source = .inlineMiDia,
        createdAt: Date = Date(),
        expiresAt: Date? = nil
    ) {
        self.originalInput = originalInput
        self.kind = kind
        self.proposedTitle = proposedTitle
        self.proposedDate = proposedDate
        self.proposedSection = proposedSection
        self.proposedLocation = proposedLocation
        self.wantsReminder = wantsReminder
        self.missingFields = missingFields
        self.questionAsked = questionAsked
        self.source = source
        self.createdAt = createdAt
        self.expiresAt = expiresAt ?? createdAt.addingTimeInterval(600)
    }
}

/// Responde a texto libre. Tiene 2 caras:
/// - `parse(_:context:)` → `NovaIntent` estructurado (para Mi Día inline).
/// - `reply(to:)` → string variado para el chat completo.
///
/// Reglas de parsing en español natural (sin IA real):
/// - **Verbos de tarea** (explícitos): "tengo que", "recordarme", "recuérdame",
///   "comprar", "llamar", "responder", "estudiar X" (sin contexto de hora),
///   "preparar", "revisar", "crea tarea", "anota".
/// - **Verbos de evento**: "agenda", "agéndame", "agéndalo", "salir a",
///   "ir a", "buscar a", "juntarme con", "reunión con", "tengo clase",
///   "tengo prueba", "tengo parcial", "clase de", "tengo evento".
/// - **Tiempo**: "hoy" / "mañana" / "pasado mañana" / día de la semana /
///   "esta tarde" / "esta noche".
/// - **Hora**: "a las HH(:MM)", "HH:MM" suelto, **"tipo N"** (colloquial,
///   default PM 13–18h para N=1–6, etc.), "HHam/pm".
/// - **Lugar**: " en <X>" al final del texto.
/// - **Sección**: heurística por palabras (parcial → estudio, buscar →
///   personal, reunión → reunión, gym → descanso, etc.).
/// - **Recurrencia**: "todos los X", "cada semana", "diario" → `RecurrenceHint`.
/// - **Contexto**: si el texto arranca con "agéndalo"/"y X"/etc. y hay un
///   `NovaContext` reciente, completamos campos faltantes (título, fecha) con
///   los del último intent.
enum NovaResponder {

    // MARK: Public API

    /// Parser multi-intent: separa frases compuestas por conectores
    /// fuertes ("y luego", "luego", "después", "también", "además") y
    /// parsea cada segmento como un intent independiente.
    ///
    /// Conservador: NO splittea por " y " solo — es demasiado ambiguo
    /// ("café y té"). Solo conectores que en español neutro siempre
    /// indican una nueva acción.
    ///
    /// Si el texto NO tiene conectores, devuelve `[parse(text)]` para
    /// compatibilidad con callers que esperan un solo intent.
    ///
    /// Heurística clave: si el primer segmento tiene un marcador temporal
    /// global ("mañana", "hoy", "el lunes") y un segmento posterior NO,
    /// le prepende ese marcador antes de parsear. Así:
    ///   "mañana despertarme a las 7:10 y luego tipo 8 salir de mi casa"
    /// segmento 1: "mañana despertarme a las 7:10" → Despertarme mañana 07:10
    /// segmento 2: "mañana tipo 8 salir de mi casa" → Salir de mi casa mañana 08:00
    static func parseAll(_ text: String, context: NovaContext = NovaContext()) -> [NovaIntent] {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let segments = splitOnStrongConnectors(trimmed)
        guard segments.count > 1 else {
            return [parse(trimmed, context: context)]
        }

        // Detectar marcador temporal global del texto completo.
        let fullLower = trimmed.lowercased()
        let inheritedDayMarker: String? = {
            if fullLower.contains("pasado mañana") || fullLower.contains("pasado manana") {
                return "pasado mañana"
            }
            if fullLower.range(of: #"\bmañana\b|\bmanana\b"#, options: .regularExpression) != nil {
                return "mañana"
            }
            if fullLower.range(of: #"\bhoy\b"#, options: .regularExpression) != nil {
                return "hoy"
            }
            // Días de la semana son más raros como global pero los soportamos.
            let weekdays = ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo"]
            for w in weekdays {
                if fullLower.range(of: "\\bel \(w)\\b", options: .regularExpression) != nil {
                    return "el \(w)"
                }
            }
            return nil
        }()

        var intents: [NovaIntent] = []
        for (i, seg) in segments.enumerated() {
            var workingSeg = seg
            // Si el segmento 2+ no tiene su propio marcador de día pero
            // el texto global sí, lo prependemos. Sin esto, "tipo 8" en
            // el segmento 2 perdería el "mañana" del segmento 1.
            if i > 0, let day = inheritedDayMarker {
                let segLower = workingSeg.lowercased()
                let hasOwnDay = segLower.contains("mañana") || segLower.contains("manana")
                    || segLower.contains("hoy")
                    || segLower.range(of: #"\b(lunes|martes|mi(é|e)rcoles|jueves|viernes|s(á|a)bado|domingo)\b"#,
                                       options: .regularExpression) != nil
                if !hasOwnDay {
                    workingSeg = "\(day) \(workingSeg)"
                }
            }
            intents.append(parse(workingSeg, context: context))
        }
        return intents
    }

    /// Conectores fuertes que indican una nueva acción dentro de la misma
    /// frase. Ordenados por longitud descendente — los más largos primero
    /// para que "y luego" gane sobre "luego" cuando coexisten.
    private static let strongConnectors: [String] = [
        " y luego ",
        " y después ",
        " y despues ",
        " y además ",
        " y ademas ",
        " y también ",
        " y tambien ",
        " luego ",
        " después de eso ",
        " despues de eso ",
        " después ",   // OJO: "después de" se mantiene como conector → split antes del "de"
        " despues ",
        " además ",
        " ademas ",
        " también ",
        " tambien "
    ]

    /// Splittea el texto en segmentos por conectores fuertes. Cada conector
    /// se reemplaza por un marker único y luego se separa por ese marker.
    ///
    /// **Bonus: split por " y " SOLO si ambos lados tienen su propia hora**.
    /// Esto cubre el caso "seguir trabajo a las 1 y comer a las 7" → 2 intents
    /// SIN romper casos sin hora propia tipo "comprar pan y leche" o
    /// "reunión con Juan y Pedro a las 5" (donde " y " forma parte del título).
    ///
    /// Heurística: para cada `" y "` ocurrencia, miramos si HAY un patrón de
    /// hora ANTES del " y " (en lo que sería el segmento izquierdo) Y
    /// DESPUÉS del " y " (en el segmento derecho). Si ambos tienen hora,
    /// es split seguro. Si solo uno o ninguno, NO split.
    ///
    /// Devuelve segmentos no vacíos, trimeados.
    private static func splitOnStrongConnectors(_ text: String) -> [String] {
        let marker = "‖SEG‖"
        var working = text
        // Primera pasada: conectores explícitos siempre splittean.
        for connector in strongConnectors {
            working = working.replacingOccurrences(
                of: connector,
                with: marker,
                options: [.caseInsensitive]
            )
        }
        // Segunda pasada: " y " con heurística de hora-en-ambos-lados.
        working = applySmartYSplit(working, marker: marker)
        return working
            .components(separatedBy: marker)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    /// Patrón regex que detecta una **hora** en español. Cubre:
    ///   - "a las 7", "a las 13:30"
    ///   - "a la 1" (singular)
    ///   - "tipo 5", "tipo las 8"
    ///   - "07:00", "13:45"
    ///   - "en 5 minutos", "en 1 hora"
    /// Excluye cosas como "1 manzana" o "2 personas" — requiere preposición
    /// o ":" o "minutos/horas" cerca.
    private static let hourMarkerPattern: String = {
        let core = #"(a la(s)?\s+\d{1,2}(:\d{2})?(\s*(am|pm|hrs?|hs))?)"#
        let bare = #"(\b\d{1,2}:\d{2}\b)"#
        let tipo = #"(\btipo\s+(la(s)?\s+)?\d{1,2}(:\d{2})?\b)"#
        let relative = #"(\ben\s+\d{1,3}\s*(min|minutos?|h|hs|hrs?|horas?)\b)"#
        // Horas en PALABRAS — "a las tres", "a la una", "tipo cuatro". El
        // smart " y " split necesita reconocerlas para que
        // "estudiar a las cinco y llamar a las ocho" splittee correctamente.
        let words = #"(\b(?:a la?s?|tipo (?:las? )?|como a la?s?|a eso de la?s?)\s+(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b)"#
        return "(\(core)|\(bare)|\(tipo)|\(relative)|\(words))"
    }()

    /// Palabras de minuto que pueden seguir a "[hora-palabra] y" para formar
    /// expresiones como "a las tres y media", "cinco y cuarto", "siete y
    /// treinta". Cuando el smart " y " split encuentra una " y " seguida por
    /// alguna de estas palabras, NO debe splittear — la " y " forma parte
    /// de la expresión de tiempo, no es un conector entre acciones.
    private static let minuteFollowupWords = "(?:media|cuarto|diez|quince|veinte|veinticinco|treinta)"

    /// Split por " y " inteligente. Pasa por TODAS las ocurrencias de
    /// `\b y \b` del texto y, para cada una, evalúa si ambos lados tienen
    /// su propia hora. Si sí → reemplaza por el marker. Si no → respeta
    /// el "y" como parte del título.
    ///
    /// Ejemplos:
    /// - "seguir trabajo a las 1 y comer a las 7" → SPLIT (hora en ambos)
    /// - "comprar pan y leche" → NO SPLIT (sin horas)
    /// - "reunión con Juan y Pedro a las 5" → NO SPLIT (solo derecha tiene hora)
    /// - "despertarme a las 7 y salir a las 8" → SPLIT
    private static func applySmartYSplit(_ text: String, marker: String) -> String {
        let lower = text.lowercased()
        // Buscar TODAS las ocurrencias de " y " (con espacios). EXCLUYE las
        // que son parte de expresión de hora ("tres y media", "cinco y cuarto",
        // "siete y veinte") usando negative lookahead — ese " y " no separa
        // acciones, es parte del time fragment.
        let yConnectorPattern = "\\s+y\\s+(?!\(minuteFollowupWords)\\b)"
        guard let regex = try? NSRegularExpression(
            pattern: yConnectorPattern, options: [.caseInsensitive]
        ) else { return text }

        let ns = text as NSString
        let lowerNS = lower as NSString
        let range = NSRange(location: 0, length: ns.length)
        let matches = regex.matches(in: text, options: [], range: range)

        guard !matches.isEmpty else { return text }

        // Para cada match, decidir si separa. Procesamos en REVERSO para
        // que los offsets no se invaliden al reemplazar.
        var result = text
        let hourRegex = try? NSRegularExpression(
            pattern: hourMarkerPattern, options: [.caseInsensitive]
        )
        for match in matches.reversed() {
            let leftSegment = lowerNS.substring(with: NSRange(
                location: 0, length: match.range.location
            ))
            let rightSegment = lowerNS.substring(with: NSRange(
                location: match.range.location + match.range.length,
                length: lowerNS.length - (match.range.location + match.range.length)
            ))
            let leftHasHour = hourRegex?.firstMatch(
                in: leftSegment,
                range: NSRange(location: 0, length: (leftSegment as NSString).length)
            ) != nil
            let rightHasHour = hourRegex?.firstMatch(
                in: rightSegment,
                range: NSRange(location: 0, length: (rightSegment as NSString).length)
            ) != nil
            if leftHasHour && rightHasHour {
                // Split seguro.
                result = (result as NSString).replacingCharacters(
                    in: match.range, with: marker
                )
            }
        }
        return result
    }

    /// Parser principal. `context` permite resolver referencias como
    /// "agéndalo X" o "y X" en base al último intent.
    static func parse(_ text: String, context: NovaContext = NovaContext()) -> NovaIntent {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        let baseWantsReminder = matches(lower, [
            "acuérdame", "acuerdame", "acordame",
            "acuérdate", "acuerdate",
            "acuérdalo", "acuerdalo",
            "acordarme",
            "recuérdame", "recuerdame", "recordame", "recordarme",
            "no olvides", "no te olvides",
            "que no se me olvide", "que me acuerde"
        ])
        // Obligación con hora puntual ("tengo que X a las N", "necesito X
        // a las N", "debo X a las N") → recordatorio, no evento de 1h.
        // Sin hora, "tengo que X" sigue siendo task (sección 5).
        let isObligationWithTime = hasTimeMarker(lower)
            && matchesAny(lower, ["tengo que ", "necesito ", "debo "])
        // Verbos puntuales (despertar/levantar/amanecer) — implican momento,
        // no duración. Centralizado en NovaActionNormalizer.
        let isPunctualVerb = NovaActionNormalizer.impliesPunctualReminder(in: lower)
        let wantsReminder = baseWantsReminder || isObligationWithTime || isPunctualVerb

        // ──────────────────────────────────────────────────────────────
        // -1. Memoria corta: si Nova preguntó algo (pendingClarification
        //     activo), tratamos la respuesta como follow-up para completar
        //     la acción original.
        //
        //     Cubre casos:
        //       "tengo parcial el jueves" → "¿A qué hora?" → "a las 3"
        //       "recuérdame llamar a Juan" → "¿Cuándo?" → "mañana a las 5"
        //       "agenda reunión con Pedro" → "¿Día y hora?" → "mañana 17:00"
        //       "buscar agustina en 20" → "¿20:00 o +20 min?" → "+20 min"
        //
        //     Si el follow-up resuelve la acción, devolvemos el intent
        //     completo. Si no resuelve (texto largo, nueva acción), caemos
        //     al flujo normal.
        // ──────────────────────────────────────────────────────────────
        if context.pendingIsActive,
           let pending = context.pendingClarification,
           let resolved = resolvePendingFollowUp(
               trimmed: trimmed,
               lower: lower,
               wantsReminder: wantsReminder,
               pending: pending
           ) {
            return resolved
        }

        // ──────────────────────────────────────────────────────────────
        // 0. Correcciones al último intent: "no, mañana", "ponlo como tarea",
        //    "cámbialo a las 18", "en sala H013". Requieren contexto fresco.
        // ──────────────────────────────────────────────────────────────
        if isCorrectionStart(lower), context.isFresh {
            // "bórralo" / "elimínalo" / "no, bórralo".
            if matches(lower, ["bórralo", "borralo", "elimínalo", "eliminalo", "borrar", "elimina eso"]) {
                return .deleteLastItem
            }
            // "ponlo como tarea" / "pásalo a tarea" → convertir.
            if matches(lower, ["como tarea", "ponlo como tarea", "pásalo a tarea", "pasalo a tarea", "convierte en tarea"]) {
                return .convertLastToTask
            }
            // "era con Pedro" / "no era Juan, era Pedro" / "era X" → cambia título.
            // Buscamos "era " + texto restante (limpiamos posibles "no era X,").
            if let newTitle = extractTitleAfterEra(lower: lower, original: trimmed) {
                return .correctLastEvent(modifier: .setTitle(newTitle))
            }
            // "no, mañana" / "no mañana" / "mejor mañana" / "ponlo mañana".
            if (lower.contains("mañana") || lower.contains("manana"))
                && !lower.contains("pasado mañana") && !lower.contains("pasado manana") {
                return .correctLastEvent(modifier: .shiftDays(offset: 1))
            }
            // "no, hoy" / "mejor hoy" (cuando contexto está en otro día).
            if lower.contains("hoy") {
                // Compute offset: cuántos días entre lastDate y hoy.
                if let lastDate = context.lastDate {
                    let cal = Calendar.current
                    let comps = cal.dateComponents([.day], from: cal.startOfDay(for: lastDate), to: cal.startOfDay(for: Date()))
                    let offset = comps.day ?? 0
                    if offset != 0 {
                        return .correctLastEvent(modifier: .shiftDays(offset: offset))
                    }
                }
            }
            // "cámbialo a las 18" / "ponlo a las 18".
            if let (h, m) = extractHourMinute(from: lower) {
                return .correctLastEvent(modifier: .setTime(hour: h, minute: m))
            }
            // "en sala H013" como corrección sola.
            if let loc = extractLocation(from: trimmed) {
                return .correctLastEvent(modifier: .setLocation(loc))
            }
            // "no" sin más → clarify.
            return .clarify(reason: .noContext)
        }

        // ──────────────────────────────────────────────────────────────
        // 1. Referencias al contexto: "agéndalo", "agéndalo como tarea X",
        //    "agéndame eso", "ponlo como tarea", "y como tarea recurrente".
        //    Solo válidas si hay contexto fresco con un título.
        // ──────────────────────────────────────────────────────────────
        if isContextReference(lower), context.isFresh, let lastTitle = context.lastTitle {
            // ¿El usuario quiere CAMBIAR el tipo (a tarea) o solo confirmar?
            if matchesAny(lower, ["tarea", "como tarea", "pendiente", "anótalo"]) {
                let recurrence = detectRecurrence(lower)
                return .createTask(
                    title: lastTitle,
                    dueDate: context.lastDate,
                    recurrence: recurrence,
                    wantsReminder: wantsReminder
                )
            }
            // Si menciona "evento" o no menciona tipo → tratar como evento.
            let when = extractDateTime(from: lower) ?? context.lastDate
            let location = extractLocation(from: trimmed) ?? context.lastLocation
            let section = context.lastSection ?? detectSection(in: lower)
            if when == nil {
                return .clarify(reason: .eventNeedsDateTime(title: lastTitle))
            }
            let explicitEnd = when.flatMap { extractExplicitEndTime(from: lower, startTime: $0) }
            return .createEvent(
                title: lastTitle,
                when: when,
                endTime: explicitEnd,
                location: location,
                section: section,
                wantsReminder: wantsReminder
            )
        }

        // ──────────────────────────────────────────────────────────────
        // 2. Borrar ejemplos / demo — siempre redirige a Ajustes.
        // ──────────────────────────────────────────────────────────────
        if matches(lower, [
            "borra ejemplo", "borrar ejemplo", "quita ejemplo", "quitar ejemplo",
            "limpia ejemplo", "limpiar ejemplo",
            "borra demo", "quita demo", "limpia demo",
            "borra los ejemplo", "quita los ejemplo",
            "borrar datos demo", "borrar datos local"
        ]) {
            return .askAboutDemo
        }

        // ──────────────────────────────────────────────────────────────
        // 3. Revisar pendientes.
        // ──────────────────────────────────────────────────────────────
        if matches(lower, [
            "revisa pendientes", "revisar pendientes",
            "qué tengo pendiente", "que tengo pendiente",
            "qué me falta", "que me falta",
            "qué tengo hoy", "que tengo hoy",
            "qué sigue", "que sigue", "qué hago ahora", "que hago ahora"
        ]) {
            return .reviewPending
        }

        // ──────────────────────────────────────────────────────────────
        // 4. Organizar el día.
        // ──────────────────────────────────────────────────────────────
        if matches(lower, [
            "organiza mi día", "organiza mi dia",
            "organiza el día", "organiza el dia",
            "planifica mi día", "planifica mi dia",
            "ordena mi día", "ordena mi dia",
            "arma mi día", "arma mi dia",
            "acomoda mi día", "acomoda mi dia"
        ]) {
            return .organizeDay
        }

        // ──────────────────────────────────────────────────────────────
        // 5. Tarea explícita: "tengo que X", "recordarme/recuérdame X",
        //    "anota tarea X", "crea tarea X", verbos de quehacer
        //    ("comprar X", "llamar X", "responder X", "preparar X",
        //    "revisar X") cuando NO hay hora explícita.
        // ──────────────────────────────────────────────────────────────
        if let title = extractAfter(trimmed, triggers: [
            "crea tarea", "crea una tarea",
            "nueva tarea", "agrega tarea", "agregar tarea",
            "anota tarea", "anota:", "tarea:"
        ], allowedTrailingPunct: ":.") {
            if title.isEmpty { return .clarify(reason: .taskNeedsTitle) }
            let when = extractDateTime(from: lower)
            let recurrence = detectRecurrence(lower)
            return .createTask(
                title: cleanTaskTitle(title, when: when),
                dueDate: when,
                recurrence: recurrence,
                wantsReminder: wantsReminder
            )
        }

        // "tengo que X" / "recordarme X" / "recuérdame X" / "avísame X" → tarea
        let taskActionTriggers = [
            "tengo que ", "recordarme ", "recuérdame ", "recuerdame ",
            "no olvides ", "no olvidar ",
            "avísame ", "avisame ", "avísame que ", "avisame que "
        ]
        if let title = extractAfter(trimmed, triggers: taskActionTriggers) {
            if title.isEmpty { return .clarify(reason: .taskNeedsTitle) }
            // Si después del trigger hay hora explícita ("recuérdame buscar a
            // la Agustina tipo 20"), es un RECORDATORIO PUNTUAL (evento con
            // isReminder=true), no una tarea sin hora. Caer al flujo de
            // evento más abajo — sección 6 lo capturará por el verbo
            // ("buscar a ") y sección 8 por la hora libre. wantsReminder ya
            // está seteado por matching ("recuérdame").
            if !hasTimeMarker(lower) {
                let when = extractDateTime(from: lower)
                let recurrence = detectRecurrence(lower)
                return .createTask(
                    title: cleanTaskTitle(title, when: when),
                    dueDate: when,
                    recurrence: recurrence,
                    wantsReminder: wantsReminder
                )
            }
            // hasTimeMarker: continúa al flujo de evento abajo.
        }

        // ──────────────────────────────────────────────────────────────
        // 6. Evento — verbos amplios para capturar lenguaje natural
        //    incluyendo informal ("salir a", "buscar a", "ir a").
        // ──────────────────────────────────────────────────────────────
        let eventTriggers = [
            "agenda", "agéndame", "agendame", "agendar",
            "agéndalo", "agendalo", "agéndala", "agendala",
            "ponme ", "ponme un ", "ponme una ", "ponme el ", "ponme la ",
            "crea evento", "crea un evento", "nuevo evento", "agrega evento",
            "reunión con", "reunion con",
            "tengo reunión", "tengo reunion",
            "tengo clase", "clase de", "clase con",
            "tengo prueba", "tengo parcial", "tengo examen", "tengo final",
            "tengo entrega",
            "tengo evento", "tengo cita", "tengo turno",
            "tengo médico", "tengo medico", "tengo doctor",
            "salir a ", "salir con ", "salgo con ",
            "ir a ", "voy a ", "vamos a ",
            "buscar a ", "ir a buscar ",
            "juntarme con ", "juntarnos con ", "junta con ", "me junto con ",
            "almuerzo con ", "cena con ", "desayuno con ", "café con "
        ]
        if matchesAny(lower, eventTriggers) {
            let title = extractEventTitle(trimmed, triggers: eventTriggers)
            let when = extractDateTime(from: lower)
            let location = extractLocation(from: trimmed)
            let section = detectSection(in: lower)
            if title.isEmpty {
                return .clarify(reason: .eventNeedsTitle)
            }
            // Caso: hay título y día pero falta hora → preguntar hora.
            if let partial = when {
                let hasExplicitTime = hasTimeMarker(lower)
                if !hasExplicitTime, isAtDayDefault(partial) {
                    return .clarify(reason: .eventNeedsTime(title: title, partialDate: partial))
                }
                let explicitEnd = extractExplicitEndTime(from: lower, startTime: partial)
                return .createEvent(
                    title: title,
                    when: partial,
                    endTime: explicitEnd,
                    location: location,
                    section: section,
                    wantsReminder: wantsReminder
                )
            }
            return .clarify(reason: .eventNeedsDateTime(title: title))
        }

        // ──────────────────────────────────────────────────────────────
        // 7. Quehaceres con verbo + complemento, sin "tengo que" explícito.
        //    Ej: "comprar materiales mañana", "llamar al dentista".
        //    Si hay hora → evento; si solo día o nada → tarea.
        // ──────────────────────────────────────────────────────────────
        let choreVerbs = [
            "comprar ", "llamar ", "responder ", "estudiar ",
            "preparar ", "revisar ", "leer ", "escribir ",
            "mandar ", "enviar ", "pagar ", "ordenar ", "limpiar "
        ]
        if let title = extractAfter(trimmed, triggers: choreVerbs) {
            if title.isEmpty { return .clarify(reason: .taskNeedsTitle) }
            let when = extractDateTime(from: lower)
            let hasExplicitTime = hasTimeMarker(lower)
            // Reconstruir el título incluyendo el verbo de chore (ej. "Comprar materiales").
            let verbUsed = firstMatchingTrigger(in: trimmed, triggers: choreVerbs) ?? ""
            let fullTitle = cleanTaskTitle(
                verbUsed.trimmingCharacters(in: .whitespacesAndNewlines) + " " + title,
                when: when
            )
            if hasExplicitTime, let date = when {
                let location = extractLocation(from: trimmed)
                let explicitEnd = extractExplicitEndTime(from: lower, startTime: date)
                return .createEvent(
                    title: fullTitle,
                    when: date,
                    endTime: explicitEnd,
                    location: location,
                    section: .personal,
                    wantsReminder: wantsReminder
                )
            }
            let recurrence = detectRecurrence(lower)
            return .createTask(title: fullTitle, dueDate: when, recurrence: recurrence, wantsReminder: wantsReminder)
        }

        // ──────────────────────────────────────────────────────────────
        // 8. Solo hora/fecha sin verbo, en frases cortas → asumir evento.
        //    Ej: "mañana 12 con Juan" → evento "Con Juan" mañana 12:00.
        //
        //    Si Nova preguntó algo antes (clarify) y guardó `pendingTitle`,
        //    completamos la acción con ese título — esto resuelve el flujo:
        //      "ir a buscar agustina en 20"
        //      → "¿20:00 o en 20 min?"
        //      → "a las 20" → crea «Buscar a Agustina» hoy 20:00.
        // ──────────────────────────────────────────────────────────────
        if let when = extractDateTime(from: lower), hasTimeMarker(lower) {
            // Limpieza completa del título: además de stripDateTime y
            // stripLocation, también quitamos triggers de recordatorio
            // ("acuérdame", "recuérdame", "no olvides") y fillers
            // ("porfa", "agéndame") para que "acuérdame probar
            // notificación en 1 minuto" devuelva título "Probar notificación"
            // y no "Acuérdame probar notificación".
            var titleRaw = stripDateTimeMarkers(stripLocationMarker(trimmed))
            titleRaw = stripReminderTriggers(titleRaw)
            titleRaw = stripFillers(titleRaw)
            let title = cleanupTitle(titleRaw)
            let location = extractLocation(from: trimmed)
            let section = detectSection(in: lower)
            if title.isEmpty {
                if context.pendingIsActive, let pending = context.pendingClarification,
                   let proposedTitle = pending.proposedTitle, !proposedTitle.isEmpty {
                    let explicitEnd = extractExplicitEndTime(from: lower, startTime: when)
                    return .createEvent(
                        title: proposedTitle,
                        when: when,
                        endTime: explicitEnd,
                        location: location ?? pending.proposedLocation ?? context.lastLocation,
                        section: section ?? pending.proposedSection ?? context.lastSection,
                        wantsReminder: wantsReminder || pending.wantsReminder
                    )
                }
                return .clarify(reason: .eventNeedsTitle)
            }
            let explicitEnd = extractExplicitEndTime(from: lower, startTime: when)
            return .createEvent(
                title: title,
                when: when,
                endTime: explicitEnd,
                location: location,
                section: section,
                wantsReminder: wantsReminder
            )
        }

        // ──────────────────────────────────────────────────────────────
        // 9. Small talk.
        // ──────────────────────────────────────────────────────────────
        if matches(lower, ["hola", "buenas", "buen día", "buen dia", "qué tal", "que tal"]) {
            return .smallTalk(reply: randomGreeting())
        }
        if matches(lower, [
            "gracias", "perfecto", "dale", "ok ", "listo",
            "genial", "buenísimo", "buenisimo"
        ]) || lower == "ok" {
            return .smallTalk(reply: randomAcknowledgment())
        }

        // 10. Sin pistas → clarify.
        return .clarify(reason: .unclear)
    }

    /// String libre para el chat. Reusa `parse` para entender el mensaje y
    /// elige una respuesta variada en base al intent. Distinto del flujo
    /// inline: acá no ejecutamos acciones, solo respondemos textualmente.
    static func reply(to text: String, context: NovaContext = NovaContext()) -> String {
        let intent = parse(text, context: context)
        switch intent {
        case .createTask(let title, let dueDate, let recurrence, let wantsReminder):
            let recBit = recurrence.map { " (\($0.label) — la recurrencia queda preparada para más adelante)" } ?? ""
            let dueBit = dueDate.map { " para el \(DateFormatters.weekdayDay.string(from: $0).lowercased())" } ?? ""
            let remBit = wantsReminder ? " Las notificaciones automáticas todavía están en preparación." : ""
            return Self.pick([
                "Anoto «\(title)»\(dueBit) como tarea\(recBit).\(remBit)",
                "Listo, agrego «\(title)»\(dueBit) a tus pendientes\(recBit).\(remBit)",
                "La meto como tarea\(dueBit)\(recBit). Si querés cambiar la prioridad, decime.\(remBit)"
            ])
        case .createEvent(let title, let when, _, let location, let section, let wantsReminder):
            let timeBit = when.map { "el \(DateFormatters.weekdayDay.string(from: $0).lowercased()) a las \(DateFormatters.hourMinute.string(from: $0))" } ?? "cuando me digas"
            let placeBit = location.map { " en \($0)" } ?? ""
            let sectionBit = section.map { " (\($0.displayName.lowercased()))" } ?? ""
            let remBit = wantsReminder ? " Las notificaciones inteligentes están en preparación." : ""
            return Self.pick([
                "Agendo «\(title)»\(placeBit) \(timeBit)\(sectionBit).\(remBit)",
                "Listo, evento «\(title)» \(timeBit)\(placeBit)\(sectionBit).\(remBit)",
                "Va «\(title)» \(timeBit)\(placeBit)\(sectionBit). Si querés cambiar algo, decime.\(remBit)"
            ])
        case .correctLastEvent(let modifier):
            switch modifier {
            case .shiftDays(let off) where off == 1:
                return "Perfecto, lo muevo para mañana."
            case .shiftDays:
                return "Listo, cambio el día."
            case .setTime(let h, let m):
                return "Cambio la hora a \(String(format: "%02d:%02d", h, m))."
            case .setLocation(let loc):
                return "Anoto la ubicación: \(loc)."
            case .setTitle(let newTitle):
                return "Actualizo el título a «\(newTitle)»."
            }
        case .convertLastToTask:
            return "Lo paso a tareas."
        case .deleteLastItem:
            return "Listo, lo elimino."
        case .organizeDay:
            return Self.pick([
                "Cuéntame qué quieres lograr hoy y armamos el día juntos.",
                "Dime tus 2 o 3 prioridades de hoy y las acomodamos.",
                "¿Qué tienes pendiente y qué te urge? Lo ordenamos."
            ])
        case .reviewPending:
            return Self.pick([
                "Tus pendientes están en Mi Día → «Pendientes de hoy».",
                "Mirá «Pendientes de hoy» en Mi Día. Si querés que los reorganice, decime «organiza mi día».",
                "Lo tenés todo arriba en Mi Día. ¿Los priorizamos por urgencia?"
            ])
        case .askAboutDemo:
            return "Los ejemplos solo aparecen mientras no tengas datos tuyos. Apenas crees tu primer evento o tarea, se reemplazan automáticamente. Si querés borrar todo, andá a Ajustes → Datos locales."
        case .smallTalk(let reply):
            return reply
        case .clarify(.taskNeedsTitle):
            return "Decime qué tarea querés que anote. Ej: «crea tarea estudiar cálculo»."
        case .clarify(.eventNeedsTitle):
            return "¿Qué evento querés que agende? Ej: «agenda reunión con Juan mañana a las 12»."
        case .clarify(.eventNeedsTime(let title, let date)):
            let day = DateFormatters.weekdayDay.string(from: date).lowercased()
            return "Tengo «\(title)» para el \(day). ¿A qué hora?"
        case .clarify(.eventNeedsDateTime(let title)):
            return "Tengo «\(title)». ¿Para qué día y a qué hora lo agendo?"
        case .clarify(.noContext):
            return "No estoy seguro a qué te referís. Decime qué querés agendar o crear."
        case .clarify(.unclear):
            return Self.pick([
                "No estoy seguro de qué hacer. ¿Querés que cree una tarea, un evento o una sugerencia?",
                "Eso no me queda claro. Probá con «crea tarea X», «agenda Y mañana a las 12» o «organiza mi día».",
                "Decime un poco más. Puedo crear tareas, agendar eventos u ordenar tu día."
            ])
        }
    }

    // MARK: - Variations (chat más vivo, menos repetitivo)

    private static func randomGreeting() -> String {
        Self.pick([
            "Hola. ¿Qué necesitás hoy?",
            "Acá estoy. ¿En qué te ayudo?",
            "Hola. Decime qué hacer y lo armo."
        ])
    }

    private static func randomAcknowledgment() -> String {
        Self.pick([
            "Listo. Si cambiás de idea, decime.",
            "Perfecto. Cualquier cosa estoy acá.",
            "Bien. Lo dejo así."
        ])
    }

    private static func pick(_ options: [String]) -> String {
        options.randomElement() ?? options.first ?? ""
    }

    // MARK: - Heurísticas de parsing

    private static func matches(_ text: String, _ keywords: [String]) -> Bool {
        keywords.contains { text.contains($0) }
    }

    private static func matchesAny(_ text: String, _ triggers: [String]) -> Bool {
        triggers.contains { text.contains($0) }
    }

    /// Encuentra el trigger que matchea en `text`. Prioriza:
    /// 1. Posición más temprana en el texto.
    /// 2. Si empatan en posición → trigger MÁS LARGO (más específico).
    /// Eso asegura que "ir a buscar " (12 chars) gane sobre "ir a " (5 chars)
    /// cuando ambos matchean en posición 0.
    private static func firstMatchingTrigger(in text: String, triggers: [String]) -> String? {
        let lower = text.lowercased()
        var best: (trigger: String, position: String.Index, length: Int)?
        for trigger in triggers {
            guard let range = lower.range(of: trigger) else { continue }
            let position = range.lowerBound
            let length = trigger.count
            if let current = best {
                // Posición más temprana; si empata, longitud mayor.
                if position < current.position {
                    best = (trigger, position, length)
                } else if position == current.position && length > current.length {
                    best = (trigger, position, length)
                }
            } else {
                best = (trigger, position, length)
            }
        }
        return best?.trigger
    }

    /// True si el texto arranca como corrección del último intent
    /// ("no, mañana", "mejor X", "ponlo X", "bórralo", "era X").
    private static func isCorrectionStart(_ lower: String) -> Bool {
        lower == "no" ||
        lower.hasPrefix("no,") || lower.hasPrefix("no ") ||
        lower.hasPrefix("mejor ") ||
        lower.hasPrefix("cámbialo") || lower.hasPrefix("cambialo") ||
        lower.hasPrefix("cámbiale") || lower.hasPrefix("cambiale") ||
        lower.hasPrefix("ponlo ") || lower.hasPrefix("ponla ") ||
        lower.hasPrefix("pásalo ") || lower.hasPrefix("pasalo ") ||
        lower.hasPrefix("muévelo") || lower.hasPrefix("muevelo") ||
        // Borrado del último item
        lower == "bórralo" || lower == "borralo" ||
        lower == "elimínalo" || lower == "eliminalo" ||
        lower == "borrar" || lower.hasPrefix("borrar ") ||
        lower.hasPrefix("elimina ") ||
        // Correcciones de identidad ("era X", "no era Juan, era Pedro")
        lower.hasPrefix("era ") || lower.contains(" era ") ||
        // Cambio de tipo
        lower.hasPrefix("agrégale") || lower.hasPrefix("agregale") ||
        lower.hasPrefix("añádele") || lower.hasPrefix("añadele")
    }

    /// True si el texto arranca con una referencia al ítem mencionado antes
    /// ("agéndalo", "agéndame eso", "ponlo como", "y X").
    private static func isContextReference(_ lower: String) -> Bool {
        let starters = [
            "agéndalo", "agendalo", "agéndala", "agendala",
            "agéndame eso", "agendame eso",
            "ponlo como", "ponla como",
            "déjalo como", "dejalo como",
            "y como tarea", "y como evento",
            "y agéndalo", "y agendalo",
            "y dejalo", "y déjalo"
        ]
        return starters.contains { lower.hasPrefix($0) || lower.contains(" \($0) ") }
    }

    // MARK: - Recurrence

    private static func detectRecurrence(_ lower: String) -> RecurrenceHint? {
        if matches(lower, ["todos los días", "todos los dias", "diariamente", "cada día", "cada dia"]) {
            return .daily
        }
        if matches(lower, ["cada semana", "semanal", "todas las semanas"]) {
            return .weekly
        }
        let weekdayMap: [(String, String)] = [
            ("todos los lunes", "los lunes"),
            ("todos los martes", "los martes"),
            ("todos los miércoles", "los miércoles"),
            ("todos los miercoles", "los miércoles"),
            ("todos los jueves", "los jueves"),
            ("todos los viernes", "los viernes"),
            ("todos los sábados", "los sábados"),
            ("todos los sabados", "los sábados"),
            ("todos los domingos", "los domingos")
        ]
        for (trigger, label) in weekdayMap where lower.contains(trigger) {
            return .weeklyOn(label: label)
        }
        if matches(lower, ["cada mes", "mensual", "mensualmente"]) {
            return .monthly
        }
        if matches(lower, ["recurrente"]) {
            return .unspecified
        }
        return nil
    }

    // MARK: - Sección por palabra-clave

    /// Wrapper público para que el caller (Mi Día) pueda guessear la sección
    /// del texto original sin acceder a internals. Usado al guardar
    /// `pendingSection` cuando Nova devuelve un clarify.
    static func guessSection(for text: String) -> EventSection? {
        detectSection(in: text.lowercased())
    }

    private static func detectSection(in lower: String) -> EventSection? {
        if matches(lower, [
            "parcial", "examen", "final", "prueba",
            "clase", "estudiar", "estudio", "tp ", "tarea de ",
            "entrega", "presentación", "presentacion", "tesis",
            "universidad", "colegio", "facultad", "liceo"
        ]) {
            return .estudio
        }
        // "reunión/reunion" SOLO match al inicio de palabra para no atrapar
        // frases tangenciales. Antes el match era substring → "comer en la
        // reunión" caía acá. Ahora usamos `matchesAny` con espacio explícito
        // o anclas.
        if matches(lower, [
            "reunión", "reunion", "review", "1:1", "1on1",
            "meet", " call ", "llamada", "stand up", "standup", "stand-up",
            "demo"
        ]) {
            return .reunion
        }
        if matches(lower, [
            "amigo", "amiga", "amigas", "amigos",
            "familia", "mamá", "papá", "mama", "papa",
            "hermano", "hermana", "hijo", "hija",
            "salir ", "buscar a ", "buscar al ", "buscar la ", "buscar el ",
            "juntarme", "juntarnos", "junta con", "me junto",
            // Comidas — "comer/almorzar/cenar/desayunar/once" siempre son
            // personal salvo que mencionen "reunión" (ya manejado arriba).
            "comer", "comida", "comerme",
            "almuerzo", "almorzar",
            "cena", "cenar",
            "desayuno", "desayunar",
            "tomar once", " once ",
            "café con", "cafe con", "merendar",
            "novia", "novio", "pareja"
        ]) {
            return .personal
        }
        // "Foco" cubre bloques de trabajo profundo. "trabajar/trabajo/
        // trabajando" sin reunión → foco (es un bloque dedicado de trabajo
        // del usuario). Excluye "trabajo de mi papá/mamá" → personal (visita
        // a familia).
        if lower.contains("trabajo de mi ") || lower.contains("trabajo de mama")
            || lower.contains("trabajo de papa") || lower.contains("trabajo de mamá")
            || lower.contains("trabajo de papá") {
            return .personal
        }
        if matches(lower, [
            "foco profundo", "deep work", "concentrar", "concentrarme",
            "trabajar", "trabajando", " trabajo", "pega ", "oficina",
            "responder mail", "revisar mail", "preparar entrega"
        ]) {
            return .foco
        }
        if matches(lower, [
            "gym", "correr", "yoga", "pilates", "running", "siesta", "pausa", "descanso",
            "entrenar", "entreno", "spinning", "crossfit", "natación", "natacion"
        ]) {
            return .descanso
        }
        return nil
    }

    // MARK: - Time markers

    /// Si el texto incluye un rango/duración explícita ("de 3 a 4",
    /// "hasta las 4", "por 1 hora"), devuelve el endTime calculado a partir
    /// del start. `nil` cuando el usuario solo dio hora de inicio.
    private static func extractExplicitEndTime(from lower: String, startTime: Date) -> Date? {
        let cal = Calendar.current
        // Caso 1: "de HH a HH(:MM)" / "de las HH a las HH"
        if let endH = firstCaptureInt(
            lower,
            pattern: #"de (la?s? )?\d{1,2}(:\d{2})? a (la?s? )?(\d{1,2})(:\d{2})?"#,
            group: 4
        ), endH >= 0, endH < 24 {
            let endM = firstCaptureInt(
                lower,
                pattern: #"de (la?s? )?\d{1,2}(:\d{2})? a (la?s? )?\d{1,2}:(\d{2})"#,
                group: 4
            ) ?? 0
            let dayStart = cal.startOfDay(for: startTime)
            let resolvedEndH = adjustAmPm(hour: endH, in: lower)
            return cal.date(bySettingHour: resolvedEndH, minute: endM, second: 0, of: dayStart)
        }
        // Caso 2: "hasta las HH(:MM)"
        if let endH = firstCaptureInt(lower, pattern: #"hasta (la?s? )?(\d{1,2})"#, group: 2),
           endH >= 0, endH < 24 {
            let endM = firstCaptureInt(lower, pattern: #"hasta (la?s? )?\d{1,2}:(\d{2})"#, group: 2) ?? 0
            let dayStart = cal.startOfDay(for: startTime)
            let resolvedEndH = adjustAmPm(hour: endH, in: lower)
            return cal.date(bySettingHour: resolvedEndH, minute: endM, second: 0, of: dayStart)
        }
        // Caso 3: "por N hora(s)/minuto(s)" / "durante N hora(s)"
        if let hours = firstCaptureInt(lower, pattern: #"(?:por|durante) (\d{1,2})\s?(h|horas?|hr|hrs)"#, group: 1) {
            return cal.date(byAdding: .hour, value: hours, to: startTime)
        }
        if let mins = firstCaptureInt(lower, pattern: #"(?:por|durante) (\d{1,3})\s?(min|minutos?)"#, group: 1) {
            return cal.date(byAdding: .minute, value: mins, to: startTime)
        }
        return nil
    }

    /// True si el texto incluye marcador explícito de hora (no solo día).
    private static func hasTimeMarker(_ lower: String) -> Bool {
        if firstCaptureInt(lower, pattern: #"a la?s? (\d{1,2})"#, group: 1) != nil { return true }
        if firstCaptureInt(lower, pattern: #"\b(\d{1,2}):(\d{2})\b"#, group: 1) != nil { return true }
        if firstCaptureInt(lower, pattern: #"\btipo\s+(?:las?\s+)?(\d{1,2})"#, group: 1) != nil { return true }
        if firstCaptureInt(lower, pattern: #"\b(\d{1,2})\s*(am|pm|hs|hrs?)\b"#, group: 1) != nil { return true }
        // Horas en PALABRAS — "a las tres", "a la una", "tipo tres", "como a
        // las cuatro", "a las tres y media", etc. Antes hasTimeMarker
        // ignoraba estas frases y por eso "necesito ir a buscar a mi
        // hermano a las tres" caía a `clarify(¿Cuándo?)`.
        let wordHourPattern = #"\b(?:a la?s?|tipo (?:las? )?|como a la?s?|a eso de la?s?|cerca de la?s?|alrededor de la?s?)\s+"# + hourWordsRegex + #"\b"#
        if lower.range(of: wordHourPattern, options: [.regularExpression, .caseInsensitive]) != nil {
            return true
        }
        // "en N minutos" / "en N min" / "en N h" / "en N hora(s)" / "en N hrs"
        if lower.range(
            of: #"\ben\s+\d{1,3}\s+(min|minutos?|h|hs|hrs?|horas?)\b"#,
            options: .regularExpression
        ) != nil { return true }
        // "en N" suelto (sin unidad) — coloquial. Tratado como minutos por
        // `extractDateTime`. Si está en la frase, hay marcador de tiempo.
        if lower.range(
            of: #"\ben\s+\d{1,3}\b(?!\s*(?:min|hora|hr|hs|h\b))"#,
            options: .regularExpression
        ) != nil { return true }
        if matches(lower, [
            "esta tarde", "esta noche", "esta mañana", "esta manana",
            "al mediodía", "al mediodia", "al atardecer",
            "en la tarde", "en la noche", "en la mañana", "en la manana",
            "después de almuerzo", "despues de almuerzo",
            "después del almuerzo", "despues del almuerzo",
            "después del trabajo", "despues del trabajo",
            "al final del día", "al final del dia",
            "al amanecer"
        ]) {
            return true
        }
        return false
    }

    /// True si la fecha es exactamente 9:00 — nuestro default cuando hay día
    /// pero no hora explícita. Lo usamos para detectar "evento sin hora".
    private static func isAtDayDefault(_ date: Date) -> Bool {
        let cal = Calendar.current
        let hour = cal.component(.hour, from: date)
        let minute = cal.component(.minute, from: date)
        return hour == 9 && minute == 0
    }

    // MARK: - Title cleanup

    private static func cleanTaskTitle(_ raw: String, when: Date?) -> String {
        var title = raw
        // Limpieza ampliada: temporal + recordatorio + fillers + ubicación,
        // luego normalizar artículos antes de nombres propios.
        title = stripDateTimeMarkers(title)
        title = stripReminderTriggers(title)
        title = stripFillers(title)
        title = stripLocationMarker(title)
        title = normalizeProperNounsAfterArticles(title)
        // Quitar muletillas pegadas al inicio.
        let stopPrefixes = [
            "que ", "de ", "el ", "la ", "los ", "las ",
            "para ", "a "
        ]
        title = title.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".,;"))
        var changed = true
        while changed {
            changed = false
            for prefix in stopPrefixes where title.lowercased().hasPrefix(prefix) {
                title = String(title.dropFirst(prefix.count))
                changed = true
            }
            title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return cleanupTitle(title)
    }

    /// Extrae el texto después del PRIMER trigger encontrado (case-insensitive).
    /// Devuelve `nil` si ningún trigger matchea, "" si matchea pero no hay texto
    /// después.
    private static func extractAfter(
        _ text: String,
        triggers: [String],
        allowedTrailingPunct: String = ""
    ) -> String? {
        let lower = text.lowercased()
        var bestIndex: String.Index?
        var bestEnd: String.Index?
        for trigger in triggers {
            if let range = lower.range(of: trigger),
               bestIndex == nil || range.lowerBound < bestIndex! {
                bestIndex = range.lowerBound
                bestEnd = range.upperBound
            }
        }
        guard let end = bestEnd else { return nil }
        var after = String(text[end...]).trimmingCharacters(in: .whitespacesAndNewlines)
        if !allowedTrailingPunct.isEmpty {
            after = after.trimmingCharacters(in: CharacterSet(charactersIn: allowedTrailingPunct))
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return after
    }

    /// Triggers cuyo verbo queremos CONSERVAR en el título final (porque tiene
    /// sentido semántico para el usuario): "Buscar a Agustina", "Salir con Juan".
    private static let keptInTitleTriggers: Set<String> = [
        "buscar a ", "ir a buscar ",
        "salir a ", "salir con ", "salgo con ",
        "ir a ", "voy a ", "vamos a ",
        "juntarme con ", "juntarnos con ", "junta con ", "me junto con ",
        "almuerzo con ", "cena con ", "desayuno con ", "café con ",
        "reunión con", "reunion con",
        "clase de", "clase con",
        "pasar a ", "pasar por "
    ]

    /// Triggers tipo "tengo X" donde X es la palabra clave que se vuelve título.
    /// "tengo clase" → "Clase". "tengo médico" → "Médico".
    private static let tengoLikeTriggers: Set<String> = [
        "tengo reunión", "tengo reunion",
        "tengo clase",
        "tengo prueba", "tengo parcial", "tengo examen", "tengo final",
        "tengo entrega",
        "tengo evento", "tengo cita", "tengo turno",
        "tengo médico", "tengo medico", "tengo doctor"
    ]

    private static func extractEventTitle(_ text: String, triggers: [String]) -> String {
        let lower = text.lowercased()
        guard let matchedTrigger = firstMatchingTrigger(in: text, triggers: triggers) else {
            return ""
        }
        let matchedLower = matchedTrigger.lowercased()

        // Caso A: verbo "kept" (mantenemos el verbo en el título reconstruido).
        if keptInTitleTriggers.contains(matchedLower) {
            // "buscar a la agustina tipo 3" → after trigger: "la agustina tipo 3"
            // → limpieza → "Agustina" → reconstruir: "Buscar a Agustina".
            let afterRaw = extractAfter(text, triggers: [matchedTrigger]) ?? ""
            var rest = afterRaw
            rest = stripDateTimeMarkers(rest)
            rest = stripReminderTriggers(rest)
            rest = stripFillers(rest)
            rest = stripLocationMarker(rest)
            rest = normalizeProperNounsAfterArticles(rest)
            rest = stripLeadingArticle(rest)
            rest = rest.trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: ".,;"))

            // Normalización de verbo "ir a buscar":
            //   - "ir a buscar a la Agustina" → "Buscar a Agustina" (idiomático;
            //     "la X" es nombre propio en español familiar, decir "ir a"
            //     resulta redundante).
            //   - "ir a buscar a mi hermano" → "Ir a buscar a mi hermano"
            //     (mantenemos el verbo; "Buscar a mi hermano" suena seco).
            //   - "ir a buscar pan" → "Ir a buscar pan" (sin nombre propio,
            //     mantenemos el verbo).
            //
            // Heurística: solo acortamos a "Buscar a" cuando el rest empieza
            // con artículo definido (la/las/el/los/al) — eso señala nombre
            // propio en español familiar.
            let trimmedTriggerLower = matchedLower.trimmingCharacters(in: .whitespacesAndNewlines)
            let normalizedVerb: String
            // Check based on AFTER-RAW (no después de la limpieza). Si el
            // usuario dijo "a la Agustina", afterRaw conserva "a la" aun cuando
            // normalizeProperNounsAfterArticles ya haya quitado el "la" de
            // `rest`. Eso preserva la lógica de acortamiento solo cuando hubo
            // artículo definido en el original.
            let afterRawHasDefiniteArticle = afterRaw.lowercased().range(
                of: #"^\s*a\s+(la|las|el|los)\s+"#,
                options: .regularExpression
            ) != nil
            let afterRawStartsWithAl = afterRaw.lowercased().hasPrefix("al ")
            if trimmedTriggerLower == "ir a buscar"
                && (afterRawHasDefiniteArticle || afterRawStartsWithAl) {
                normalizedVerb = "Buscar a"
                // Strip leading "a (la/las/el/los) " — caso normal antes de
                // normalizeProperNounsAfterArticles. También strip simplemente
                // "a " — caso post-normalize (la X → X queda como "a X").
                // Sin esto el concat queda "Buscar a a Agustina".
                let leadingPrefixes = ["a la ", "a las ", "a el ", "a los ", "al ", "a "]
                for p in leadingPrefixes where rest.lowercased().hasPrefix(p) {
                    rest = String(rest.dropFirst(p.count))
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    break
                }
            } else {
                normalizedVerb = capitalizeFirst(trimmedTriggerLower)
            }

            // Capitalizar primera palabra de `rest` si es minúscula y no es
            // una preposición/artículo — captura "agustina" → "Agustina"
            // cuando no fue normalizado por el artículo previo.
            rest = capitalizeFirstNounIfLower(rest)

            if rest.isEmpty { return normalizedVerb }

            // Edge: si el trigger termina en " a" (ej. "salir a", "ir a") y
            // el `rest` arranca con un número, el "a" del trigger era parte
            // de "a las N" (hora), no preposición de destino. Reparamos:
            //
            //   - "salir a las 8"                 → "Salir"
            //   - "ir a las 7"                    → "Ir"
            //   - "salir a las 6 para la universidad" → "Salir para Universidad"
            //
            // (la limpieza de destino final corre en NovaActionNormalizer.cleanTitle).
            let restStartsWithHour = rest.range(
                of: #"^\d{1,2}(:\d{2})?\b"#,
                options: .regularExpression
            ) != nil
            if restStartsWithHour && trimmedTriggerLower.hasSuffix(" a") {
                let verbOnly = String(trimmedTriggerLower.dropLast(2))
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                let verbCap = capitalizeFirst(verbOnly)
                // Strip el número (la hora) del comienzo del rest, lo que
                // quede es el destino/contexto real.
                let withoutHour = rest.replacingOccurrences(
                    of: #"^\d{1,2}(:\d{2})?\s*"#,
                    with: "",
                    options: .regularExpression
                ).trimmingCharacters(in: .whitespacesAndNewlines)
                if withoutHour.isEmpty {
                    return verbCap
                }
                return "\(verbCap) \(withoutHour)"
            }

            return "\(normalizedVerb) \(rest)"
        }

        // Caso B: trigger tipo "tengo X" — el título es X.
        if tengoLikeTriggers.contains(matchedLower) {
            let keyword = matchedLower
                .replacingOccurrences(of: "tengo ", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return capitalizeFirst(keyword)
        }

        // Caso C: trigger es comando ("agenda", "ponme", "crea evento") → strip
        // y limpieza estándar de lo que queda.
        guard var raw = extractAfter(text, triggers: [matchedTrigger], allowedTrailingPunct: ":.") else {
            return ""
        }
        raw = stripDateTimeMarkers(raw)
        raw = stripReminderTriggers(raw)
        raw = stripFillers(raw)
        raw = stripLocationMarker(raw)
        raw = normalizeProperNounsAfterArticles(raw)
        raw = stripLeadingArticle(raw)
        raw = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".,;"))
        return cleanupTitle(raw)
    }

    /// "la agustina" → "Agustina". "el carlos" → "Carlos". Solo si el artículo
    /// va al inicio del texto y la siguiente palabra es una letra simple.
    private static func stripLeadingArticle(_ text: String) -> String {
        let lower = text.lowercased()
        for article in ["la ", "el ", "las ", "los "] {
            if lower.hasPrefix(article) {
                let dropped = String(text.dropFirst(article.count))
                return capitalizeFirst(dropped)
            }
        }
        return text
    }

    /// Capitaliza solo la primera letra de un texto multi-palabra.
    private static func capitalizeFirst(_ s: String) -> String {
        guard let first = s.first else { return s }
        return first.uppercased() + s.dropFirst()
    }

    /// Capitaliza solo la primera letra y normaliza espacios.
    private static func cleanupTitle(_ raw: String) -> String {
        let collapsed = raw
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        guard let first = collapsed.first else { return collapsed }
        return first.uppercased() + collapsed.dropFirst()
    }

    /// Capitaliza la primera palabra de `text` SOLO si es un sustantivo (no
    /// preposición ni artículo). Captura "agustina" → "Agustina" cuando no
    /// hubo artículo previo que dispare `normalizeProperNounsAfterArticles`.
    /// Conservador: si la palabra es preposición/artículo conocida, queda
    /// como está (otro paso del pipeline ya la habrá manejado).
    private static func capitalizeFirstNounIfLower(_ text: String) -> String {
        let prepositionsAndArticles: Set<String> = [
            "a", "con", "de", "del", "para", "por", "en", "y", "o",
            "el", "la", "los", "las", "un", "una", "unos", "unas",
            "al",
            // Posesivos — "mi hermano" no debe quedar "Mi hermano". "Mi/Tu/
            // Su" capitalizado se ve raro en mitad de un título.
            "mi", "mis", "tu", "tus", "su", "sus",
            "nuestro", "nuestra", "nuestros", "nuestras",
            "vuestro", "vuestra", "vuestros", "vuestras"
        ]
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return trimmed }
        let parts = trimmed.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: false)
        guard let firstWord = parts.first else { return trimmed }
        let firstStr = String(firstWord)
        if prepositionsAndArticles.contains(firstStr.lowercased()) { return trimmed }
        guard let firstChar = firstStr.first, firstChar.isLowercase else { return trimmed }
        let cap = firstStr.prefix(1).uppercased() + firstStr.dropFirst()
        if parts.count > 1 {
            return cap + " " + String(parts[1])
        }
        return cap
    }

    private static let dateTimeMarkerPatterns: [String] = [
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
        #"\bal amanecer\b"#,
        // Hora explícita "a las HH(:MM)(am|pm|hrs)" — el orden importa, va antes de "tipo".
        #"\ba la?s? \d{1,2}(:\d{2})?\s*(am|pm|hrs?|de la (mañana|manana|tarde|noche))?\b"#,
        #"\b\d{1,2}:\d{2}\b"#,
        // Hora coloquial: "tipo 3", "tipo las 3", "como a las 3", "a eso de las 3",
        // "cerca de las 3", "alrededor de las 3".
        #"\btipo (las? )?\d{1,2}(:\d{2})?\b"#,
        #"\bcomo a la?s? \d{1,2}(:\d{2})?\b"#,
        #"\b(a eso de|cerca de|alrededor de|por) la?s? \d{1,2}(:\d{2})?\b"#,
        // Hora en PALABRAS — "a las tres", "a la una", "a las tres y media",
        // "a las tres y cuarto", "a las tres treinta", "tipo tres", "como a
        // las tres". Va junto con sus sufijos opcionales ("de la mañana/tarde"
        // y minutos como palabra). El orden importa: ANTES que el patrón
        // genérico de artículos para que "a las tres" no quede como "a Tres".
        #"\b(a la?s?|tipo (las? )?|como a la?s?|a eso de la?s?|cerca de la?s?|alrededor de la?s?)\s+(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(\s+y\s+(media|cuarto|diez|quince|veinte|veinticinco|treinta))?(\s+(treinta|quince))?(\s+de la (mañana|manana|tarde|noche))?\b"#,
        // Relativo "en N minutos" / "en N horas" — orden importa: va ANTES
        // que "en N" suelto para que se consuma con la unidad.
        #"\ben\s+\d{1,3}\s+(min|minutos?|h|hs|hrs?|horas?)\b"#,
        // "N hrs" / "N hs" sueltos (24h, ej. "20 hrs").
        #"\b\d{1,2}\s*hrs?\b"#,
        #"\b\d{1,2}\s*hs\b"#,
        // "en N" suelto (sin unidad) — cuando "en" + número aparece pegado
        // a una acción, es un horario o un offset; en cualquier caso, no debe
        // quedar en el título. Se procesa al final para no comerse "en N min".
        #"\ben\s+\d{1,2}\b"#
    ]

    /// Frases que activan recordatorio. Las quitamos del título porque no son
    /// parte de la acción, son metadata ("acuérdame" = "manda notificación").
    private static let reminderTriggerPatterns: [String] = [
        #"\bacu(é|e)rdame\b"#,
        #"\bacu(é|e)rdate\b"#,
        #"\bacu(é|e)rdalo\b"#,
        #"\bacordarme\b"#,
        #"\bacordame\b"#,
        #"\brecu(é|e)rdame\b"#,
        #"\brecuerdame\b"#,
        #"\brecordame\b"#,
        #"\brecordarme\b"#,
        #"\bno (te )?olvides( de)?\b"#,
        #"\bque no se me olvide\b"#,
        #"\bque me acuerde\b"#,
        #"\bav(í|i)same( que)?\b"#
    ]

    /// Fillers que se quitan del título por amabilidad ("porfa", "oye"…).
    /// También verbos de "agenda" que solo añaden ruido al título real.
    /// "Necesito"/"debo" son obligación → no son parte de la acción, se
    /// quitan para que el título quede limpio ("necesito ir a buscar a mi
    /// hermano" → "Ir a buscar a mi hermano").
    private static let fillerPatterns: [String] = [
        #"\bporfa(vor)?\b"#,
        #"\bpor favor\b"#,
        #"\boye\b"#,
        #"\bhey\b"#,
        #"\bdale\b"#,
        #"\bponme\b"#,
        #"\btengo que\b"#,
        #"\bnecesito\b"#,
        #"\bdebo\b"#,
        #"\bagéndame\b"#, #"\bagendame\b"#,
        #"\bagéndalo\b"#, #"\bagendalo\b"#,
        // "antes del viernes" → marcador de deadline, lo quitamos del título
        // (queda como nota futura cuando implementemos deadlines de tarea).
        #"\bantes del? (lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b"#
    ]

    private static func stripDateTimeMarkers(_ text: String) -> String {
        replaceAll(in: text, patterns: dateTimeMarkerPatterns)
    }

    private static func stripReminderTriggers(_ text: String) -> String {
        replaceAll(in: text, patterns: reminderTriggerPatterns)
    }

    private static func stripFillers(_ text: String) -> String {
        replaceAll(in: text, patterns: fillerPatterns)
    }

    private static func replaceAll(in text: String, patterns: [String]) -> String {
        var out = text
        for pattern in patterns {
            out = out.replacingOccurrences(
                of: pattern,
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
        }
        return out
    }

    /// Quita artículos antes de nombres propios y los capitaliza:
    /// "a la agustina" → "a Agustina"; "con el carlos" → "con Carlos".
    /// Conservador — solo casos donde el artículo precede a palabra
    /// minúscula simple (sin números ni puntuación).
    private static func normalizeProperNounsAfterArticles(_ text: String) -> String {
        let pattern = #"\b(a|con|de|para|por) (la|las|el|los) ([a-záéíóúñ]+)\b"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return text
        }
        let ns = text as NSString
        var result = text
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: ns.length))
        // Iterar en reversa para no invalidar rangos al reemplazar.
        for match in matches.reversed() {
            guard match.numberOfRanges >= 4 else { continue }
            let prepRange = match.range(at: 1)
            let nounRange = match.range(at: 3)
            let prep = ns.substring(with: prepRange)
            let noun = ns.substring(with: nounRange)
            let capitalized = noun.prefix(1).uppercased() + noun.dropFirst()
            let replacement = "\(prep) \(capitalized)"
            result = (result as NSString).replacingCharacters(in: match.range, with: replacement)
        }
        return result
    }

    private static func stripLocationMarker(_ text: String) -> String {
        // " en <X>" hasta fin o coma/punto. Lo quitamos del título.
        text.replacingOccurrences(
            of: #" en [^.,;\n]+"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
    }

    /// Devuelve fecha+hora si el texto incluye marcador temporal. Si solo hay
    /// hora sin día, asume hoy (o mañana si la hora ya pasó). Si solo hay día
    /// sin hora, asume 9:00 (lo usamos como flag de "necesita hora").
    private static func extractDateTime(from lower: String) -> Date? {
        let cal = Calendar.current
        let now = Date()

        // Offset relativo a "ahora". Tres patrones, en orden:
        //   "en N minutos" / "en N min"  → +N minutos (explícito)
        //   "en N horas"   / "en N h"    → +N horas   (explícito)
        //   "en N"         (sin unidad)  → +N minutos (regla coloquial:
        //     "ir a buscar agustina en 20" / "salgo en 20" / "te llamo en 5"
        //     siempre significa minutos. Si el usuario quería 20:00 dice "a
        //     las 20", "tipo 20", "20 hrs" o "20:00".)
        if let mins = firstCaptureInt(
            lower,
            pattern: #"\ben\s+(\d{1,3})\s+(min|minutos?)\b"#,
            group: 1
        ), mins > 0, mins <= 720 {
            return cal.date(byAdding: .minute, value: mins, to: now)
        }
        if let hours = firstCaptureInt(
            lower,
            pattern: #"\ben\s+(\d{1,2})\s+(h|hs|hrs?|horas?)\b"#,
            group: 1
        ), hours > 0, hours <= 12 {
            return cal.date(byAdding: .hour, value: hours, to: now)
        }
        // "en N" suelto sin unidad. Default a minutos. Aceptamos 1..180
        // (3h) — más allá empieza a sonar a hora del día y dudoso.
        if let mins = firstCaptureInt(
            lower,
            pattern: #"\ben\s+(\d{1,3})\b(?!\s*(?:min|hora|hr|hs|h\b))"#,
            group: 1
        ), mins > 0, mins <= 180 {
            return cal.date(byAdding: .minute, value: mins, to: now)
        }

        var dayBase: Date? = nil
        var dayWasExplicit = false

        if lower.range(of: #"\bpasado ma(ñ|n)ana\b"#, options: .regularExpression) != nil {
            dayBase = cal.date(byAdding: .day, value: 2, to: now)
            dayWasExplicit = true
        } else if lower.range(of: #"\bma(ñ|n)ana\b"#, options: .regularExpression) != nil {
            dayBase = cal.date(byAdding: .day, value: 1, to: now)
            dayWasExplicit = true
        } else if lower.contains("hoy")
            || lower.contains("esta tarde") || lower.contains("esta noche")
            || lower.contains("esta mañana") || lower.contains("esta manana")
            || lower.contains("al mediodía") || lower.contains("al mediodia")
            || lower.contains("en la tarde") || lower.contains("en la noche")
            || lower.contains("en la mañana") || lower.contains("en la manana")
            || lower.contains("después de almuerzo") || lower.contains("despues de almuerzo")
            || lower.contains("después del trabajo") || lower.contains("despues del trabajo")
            || lower.contains("al final del día") || lower.contains("al final del dia") {
            dayBase = now
            dayWasExplicit = true
        } else if let target = nextWeekday(in: lower, calendar: cal, from: now) {
            dayBase = target
            dayWasExplicit = true
        }

        // Hora explícita
        let hm = extractHourMinute(from: lower)

        if dayBase == nil && hm == nil { return nil }

        var base = dayBase ?? now
        if let (h, m) = hm {
            let start = cal.startOfDay(for: base)
            base = cal.date(bySettingHour: h, minute: m, second: 0, of: start) ?? start
            // Política V1: si NO se dio día explícito, mantenemos **HOY** aun
            // si la hora ya pasó. Es más predecible que adivinar
            // (martes 12 · 03:00 era el bug). El usuario corrige con
            // "no, mañana" usando contexto.
            //
            // Solo bumpeamos si la hora pasó *y* el verbo no implica algo
            // inminente, *y* el offset es muy grande (>4h). Eso captura
            // "a las 9" tipeado a la 1am (claramente quería 9am).
            if !dayWasExplicit, base <= now {
                let gap = now.timeIntervalSince(base)  // segundos en el pasado
                if !isImminentActivity(lower), gap > 14_400 {  // > 4 horas
                    base = cal.date(byAdding: .day, value: 1, to: base) ?? base
                }
            }
            return base
        }
        // Día sin hora → 9:00 (placeholder; el caller debería detectarlo
        // como "necesita hora" vía `isAtDayDefault`).
        let start = cal.startOfDay(for: base)
        return cal.date(bySettingHour: 9, minute: 0, second: 0, of: start)
    }

    /// Extrae el nuevo título de frases como "era con Pedro", "era Pedro",
    /// "no era Juan, era Pedro". Devuelve `nil` si no encuentra patrón claro.
    /// Requiere que aparezca la palabra "era" seguida de texto.
    private static func extractTitleAfterEra(lower: String, original: String) -> String? {
        // Patrón: "era con X" o "era X". Tomamos lo que viene después del
        // ÚLTIMO "era" para casos como "no era Juan, era Pedro".
        guard let range = lower.range(of: " era ", options: .backwards)
                ?? lower.range(of: "era ", options: .backwards) else { return nil }
        let afterStart = original.index(original.startIndex, offsetBy: lower.distance(from: lower.startIndex, to: range.upperBound))
        guard afterStart < original.endIndex else { return nil }
        var after = String(original[afterStart...]).trimmingCharacters(in: .whitespacesAndNewlines)
        // Limpiar: si empieza con "con ", quitar para que el título sea solo el nombre.
        let conPrefix = "con "
        if after.lowercased().hasPrefix(conPrefix) {
            after = String(after.dropFirst(conPrefix.count))
        }
        after = after.trimmingCharacters(in: CharacterSet(charactersIn: ".,;"))
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !after.isEmpty else { return nil }
        // Reconstruir "Con Pedro" si había "con" inicialmente.
        if lower.contains("era con ") || lower.contains(" era con ") {
            return "Con " + cleanupTitle(after)
        }
        return cleanupTitle(after)
    }

    /// Verbos que implican acción cercana hoy mismo. Cuando aparecen en el
    /// texto y no hay día explícito, asumimos hoy (no bumpear a mañana).
    private static func isImminentActivity(_ lower: String) -> Bool {
        matches(lower, [
            "ir a ", "voy a ", "vamos a ",
            "salir a ", "salir con ", "salgo ",
            "buscar a ", "ir a buscar ",
            "pasar a ", "pasar por ",
            "juntarme con ", "me junto",
            "acuérdame", "acuerdame", "recuérdame", "recuerdame"
        ])
    }

    private static func nextWeekday(in text: String, calendar: Calendar, from: Date) -> Date? {
        let map: [(String, Int)] = [
            ("domingo", 1),
            ("lunes", 2),
            ("martes", 3),
            ("miércoles", 4), ("miercoles", 4),
            ("jueves", 5),
            ("viernes", 6),
            ("sábado", 7), ("sabado", 7)
        ]
        for (name, weekday) in map {
            if text.contains(name) {
                // Próxima ocurrencia de ese weekday desde "from".
                var comps = DateComponents()
                comps.weekday = weekday
                if let next = calendar.nextDate(
                    after: from,
                    matching: comps,
                    matchingPolicy: .nextTime
                ) {
                    return next
                }
            }
        }
        return nil
    }

    private static func extractHourMinute(from text: String) -> (Int, Int)? {
        // 1) "a las 14:30" / "a la 1:00" (también "a eso de las 14:30").
        //    Cuando la hora está en 1..12 SIN modificador (am/pm, "de la tarde",
        //    etc.) hay que aplicar `adjustAmPm` también — antes "a las 3:30"
        //    se devolvía como (3, 30) literal y caía a 03:30 aunque el contexto
        //    (verbo "trabajar/comer/etc") dijera tarde. Para hours 13..23 el
        //    valor es 24h y se mantiene literal.
        if let h = firstCaptureInt(text, pattern: #"(?:a la?s?|eso de las?|cerca de las?|alrededor de las?) (\d{1,2}):(\d{2})"#, group: 1),
           let m = firstCaptureInt(text, pattern: #"(?:a la?s?|eso de las?|cerca de las?|alrededor de las?) (\d{1,2}):(\d{2})"#, group: 2),
           h < 24, m < 60 {
            let resolvedH = h <= 12 ? adjustAmPm(hour: h, in: text) : h
            return (resolvedH, m)
        }
        // 1b) Horas en PALABRAS — "a las tres", "a la una", "a las siete y media",
        //     "a las tres y cuarto", "a las tres treinta", "tipo tres", "como a
        //     las tres", "a eso de las cuatro". Usuario habla por voz y
        //     transcripción mete los números como palabras → el parser los
        //     ignoraba antes y mandaba a `clarify(¿Cuándo?)`. Soporta también
        //     "y media" (+30), "y cuarto" (+15), "y treinta", "y quince".
        if let (h, m) = extractWordHourMinute(from: text) {
            let resolvedH = h <= 12 ? adjustAmPm(hour: h, in: text) : h
            return (resolvedH, m)
        }
        // 2) "a las 12" / "a la 1" / "a eso de las 3" / "cerca de las 3"
        if let h = firstCaptureInt(text, pattern: #"(?:a la?s?|eso de las?|cerca de las?|alrededor de las?) (\d{1,2})\b"#, group: 1), h < 24 {
            return (adjustAmPm(hour: h, in: text), 0)
        }
        // 3) "14:30" suelto. Igual que (1): si h <= 12, contexto puede
        //    moverlo a PM. "salir a las 7:00" sin "am" → si el contexto dice
        //    mañana queda 07:00, si dice tarde queda 19:00, sino regla
        //    coloquial 1-7 → PM.
        if let h = firstCaptureInt(text, pattern: #"\b(\d{1,2}):(\d{2})\b"#, group: 1),
           let m = firstCaptureInt(text, pattern: #"\b(\d{1,2}):(\d{2})\b"#, group: 2),
           h < 24, m < 60 {
            let resolvedH = h <= 12 ? adjustAmPm(hour: h, in: text) : h
            return (resolvedH, m)
        }
        // 4) "tipo N" / "tipo las N" — colloquial Chilean.
        //    Default a PM para N=1..11 (uso social diurno), salvo que el
        //    texto diga explícitamente "de la mañana".
        if let n = firstCaptureInt(text, pattern: #"\btipo\s+(?:las?\s+)?(\d{1,2})"#, group: 1),
           n >= 0, n < 24 {
            return (resolveTipoHour(n, in: text), 0)
        }
        // 5) "3pm" / "8am" / "12 pm"
        if let n = firstCaptureInt(text, pattern: #"\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b"#, group: 1),
           n >= 0, n <= 12 {
            let isPM = text.range(of: #"\b\d{1,2}\s*(pm|p\.m\.)\b"#, options: .regularExpression) != nil
            if n == 12 {
                return isPM ? (12, 0) : (0, 0)
            }
            return isPM ? (n + 12, 0) : (n, 0)
        }
        // 5b) Notación 24h coloquial: "20 hrs", "20 hs", "20:00 hrs", "8 hrs"
        //     — el número se toma literal (no se aplica adjustAmPm). Solo
        //     0..23 son válidos.
        if let n = firstCaptureInt(text, pattern: #"\b(\d{1,2})\s*hrs?\b"#, group: 1),
           n >= 0, n < 24 {
            return (n, 0)
        }
        if let n = firstCaptureInt(text, pattern: #"\b(\d{1,2})\s*hs\b"#, group: 1),
           n >= 0, n < 24 {
            return (n, 0)
        }
        // 6) "esta tarde" / "esta noche" / "al mediodía"
        if text.contains("esta noche") { return (20, 0) }
        if text.contains("esta tarde") { return (16, 0) }
        if text.contains("al mediodía") || text.contains("al mediodia") { return (12, 0) }
        if text.contains("esta mañana") || text.contains("esta manana") { return (9, 0) }
        // 7) Marcadores naturales coloquiales sin "esta":
        //    "en la tarde", "en la noche", "en la mañana".
        if text.contains("en la noche") { return (20, 0) }
        if text.contains("en la tarde") { return (16, 0) }
        if text.contains("en la mañana") || text.contains("en la manana") { return (9, 0) }
        // 8) Referencias a comidas/momentos: "después de almuerzo" → 15:00
        //    (post-comida típica). "después del trabajo" → 18:00.
        //    "al final del día" → 18:00. "al amanecer" → 7:00.
        if text.contains("después de almuerzo") || text.contains("despues de almuerzo")
            || text.contains("después de almorzar") || text.contains("despues de almorzar")
            || text.contains("después del almuerzo") || text.contains("despues del almuerzo") {
            return (15, 0)
        }
        if text.contains("después del trabajo") || text.contains("despues del trabajo") {
            return (18, 0)
        }
        if text.contains("al final del día") || text.contains("al final del dia") { return (18, 0) }
        if text.contains("al amanecer") { return (7, 0) }
        return nil
    }

    /// Mapa de palabras de hora en español a entero (1..12). El usuario
    /// dicta "a las tres" por voz y la transcripción mete números como
    /// palabras — antes el parser ignoraba estas frases y caía a
    /// `clarify(¿Cuándo?)`. Soporta los 12 numerales + variantes "una/uno".
    private static let hourWords: [String: Int] = [
        "una": 1, "uno": 1,
        "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
        "seis": 6, "siete": 7, "ocho": 8, "nueve": 9,
        "diez": 10, "once": 11, "doce": 12
    ]

    /// Regex pattern union de las palabras-hora (1..12). Se usa en varios
    /// lugares: extractHourMinute, hasTimeMarker, stripDateTimeMarkers.
    private static let hourWordsRegex: String =
        "(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)"

    /// Extrae (hora, minuto) de frases con NÚMERO ESCRITO EN PALABRAS.
    /// Soporta:
    ///   - "a las tres" → (3, 0)
    ///   - "a la una" → (1, 0)
    ///   - "tipo tres" → (3, 0)
    ///   - "como a las tres" → (3, 0)
    ///   - "a eso de las cuatro" → (4, 0)
    ///   - "a las tres y media" → (3, 30)
    ///   - "a las tres y cuarto" → (3, 15)
    ///   - "a las tres treinta" → (3, 30)
    ///   - "a las tres quince" → (3, 15)
    ///   - "a las tres y diez" → (3, 10)  (minutos como palabra cardinal)
    private static func extractWordHourMinute(from text: String) -> (Int, Int)? {
        // Prefijos: "a la(s)", "tipo (las)", "como a las", "a eso de las",
        // "cerca de las", "alrededor de las".
        let prefix = #"(?:a la?s?|tipo (?:las? )?|como a la?s?|a eso de la?s?|cerca de la?s?|alrededor de la?s?)"#

        // Patrón completo: prefijo + hour-word + (opcional " y media/cuarto"
        // | " y diez/quince/veinte/veinticinco/treinta" | " treinta/quince").
        let combined = "\(prefix)\\s+\(hourWordsRegex)" +
            #"(?:\s+y\s+(media|cuarto|diez|quince|veinte|veinticinco|treinta))?"# +
            #"(?:\s+(treinta|quince))?"# +
            #"\b"#

        guard let regex = try? NSRegularExpression(
            pattern: combined,
            options: [.caseInsensitive]
        ) else { return nil }

        let ns = text as NSString
        guard let match = regex.firstMatch(
            in: text,
            range: NSRange(location: 0, length: ns.length)
        ) else { return nil }

        let hourWord = ns.substring(with: match.range(at: 1)).lowercased()
        guard let h = hourWords[hourWord] else { return nil }

        var m = 0
        if match.range(at: 2).location != NSNotFound {
            let minuteWord = ns.substring(with: match.range(at: 2)).lowercased()
            m = minuteWordToInt(minuteWord) ?? 0
        } else if match.range(at: 3).location != NSNotFound {
            let minuteWord = ns.substring(with: match.range(at: 3)).lowercased()
            m = minuteWordToInt(minuteWord) ?? 0
        }
        return (h, m)
    }

    /// Convierte "media"/"cuarto"/cardinales-de-minutos → entero.
    private static func minuteWordToInt(_ word: String) -> Int? {
        switch word {
        case "media": return 30
        case "cuarto": return 15
        case "diez": return 10
        case "quince": return 15
        case "veinte": return 20
        case "veinticinco": return 25
        case "treinta": return 30
        default: return nil
        }
    }

    /// "tipo 3" → 15. "tipo 8 de la mañana" → 8. "tipo 12" → 12.
    private static func resolveTipoHour(_ n: Int, in text: String) -> Int {
        let isMorning = text.contains("de la mañana") || text.contains("de la manana") || text.contains(" am")
        let isAfternoon = text.contains("de la tarde") || text.contains("de la noche") || text.contains(" pm")
        if isMorning { return n == 12 ? 0 : n }
        if isAfternoon, n < 12 { return n + 12 }

        // Verb context override antes de la regla coloquial (igual que adjustAmPm).
        switch detectHourContext(in: text) {
        case .forceAM:
            return n == 12 ? 0 : n
        case .forcePM:
            if n == 0 { return 12 }
            if n == 12 { return 12 }
            return n < 12 ? n + 12 : n
        case .neutral:
            break
        }

        if n == 0 { return 12 }
        if n == 12 { return 12 }
        if n >= 13 { return n }  // ya en formato 24h
        // 1..11 sin modificador → asumir PM (uso social común).
        return n + 12
    }

    /// Ajusta hora N=1..12 cuando no hay marcador AM/PM. Regla coloquial
    /// para español chileno/latino, refinada con **contexto de verbo**:
    ///
    /// - Marcador explícito "am"/"de la mañana"/"madrugada" → AM (mantener hora).
    /// - Marcador explícito "pm"/"de la tarde"/"de la noche" → PM (+12).
    /// - **Verbo de mañana** (despertar, levantar, amanecer, desayunar) →
    ///   forzar AM ("despertarme a las 7" = 07:00, no 19:00).
    /// - **Verbo de comida/noche** (cenar, comer, almorzar, once) → forzar PM
    ///   ("cenar a las 8" = 20:00, "comer a las 7" = 19:00).
    /// - **Acción matinal** ("salir/ir/entrar" + universidad/colegio/escuela
    ///   /clase/facultad) → forzar AM ("salir a las 6 para la universidad" = 06:00).
    /// - Sin contexto:
    ///   - 1..7 → PM (uso social/diurno típico).
    ///   - 8..11 → AM (típico horario laboral/escolar de mañana).
    ///   - 12 → 12:00 (mediodía).
    private static func adjustAmPm(hour: Int, in text: String) -> Int {
        guard hour <= 12 else { return hour }

        // 1) AM explícito.
        if text.range(of: #"\b\d{1,2}\s*(am|a\.m\.)\b"#, options: .regularExpression) != nil
            || text.contains("de la mañana") || text.contains("de la manana")
            || text.contains("madrugada") {
            return hour == 12 ? 0 : hour
        }

        // 2) PM explícito.
        if text.range(of: #"\b\d{1,2}\s*(pm|p\.m\.)\b"#, options: .regularExpression) != nil
            || text.contains("de la tarde") || text.contains("de la noche") {
            return hour == 12 ? 12 : hour + 12
        }

        // 3) Verb context override antes de la regla coloquial.
        switch detectHourContext(in: text) {
        case .forceAM:
            return hour == 12 ? 0 : hour
        case .forcePM:
            return hour == 12 ? 12 : hour + 12
        case .neutral:
            break
        }

        // 4) Sin marcador → regla coloquial chilena/latina.
        if hour >= 1 && hour <= 7 { return hour + 12 }   // 1→13, 3→15, 7→19
        return hour                                        // 8..12 quedan AM
    }

    /// Resultado de inspeccionar el segmento de texto buscando verbos /
    /// contextos que fuercen la hora a AM o PM cuando no hay marcador
    /// explícito ("am"/"pm"/"de la mañana"/"de la tarde").
    private enum HourContext {
        case forceAM
        case forcePM
        case neutral
    }

    /// Detecta verbos y contextos que desambiguan horas 1..12 cuando no hay
    /// marcador AM/PM explícito. Mantener conservador — solo verbos cuyo
    /// significado temporal es claro y no se solapa con otros usos.
    ///
    /// - **AM**: despertar, levantar, amanecer, desayunar.
    /// - **AM por destino**: "salir/ir/entrar" + clase/universidad/colegio/
    ///   escuela/facultad. NO incluye "trabajo/oficina" porque "salir del
    ///   trabajo a las 5" debe leerse como 17:00, no 05:00.
    /// - **PM**: cenar, comer, almorzar, once (la comida chilena, no el
    ///   número).
    private static func detectHourContext(in text: String) -> HourContext {
        let lower = text.lowercased()

        // 1) Verbos AM fuertes (despertar / levantar / amanecer / desayunar).
        let amVerbPattern = #"\b(despertar(me|te|se|nos|los)?|despertame|despertarnos|despierto|despierta|levantar(me|te|se|nos|los)?|levantame|levantarnos|levanto|levanta|amanecer|amanezca|amanezco|desayunar|desayuno|desayunamos)\b"#
        if lower.range(of: amVerbPattern, options: .regularExpression) != nil {
            return .forceAM
        }

        // 2) Acción matinal de desplazamiento + destino educacional.
        //    "salir a la universidad" / "ir a clase" / "entrar al colegio".
        let hasMorningAction = lower.range(
            of: #"\b(salir|salgo|sale|ir|voy|vamos|entrar|entro|entra)\b"#,
            options: .regularExpression
        ) != nil
        let hasSchoolWord = lower.range(
            of: #"\b(clase|clases|universidad|colegio|escuela|facultad|liceo|preescolar)\b"#,
            options: .regularExpression
        ) != nil
        if hasMorningAction && hasSchoolWord {
            return .forceAM
        }

        // 3) Verbos PM fuertes — comidas (almuerzo o cena). En español
        //    latino "comer" se usa tanto para almuerzo como cena → siempre
        //    PM. Excluimos formas como "como" / "come" (tercera/primera
        //    persona indicativo) porque "como" es preposición ambigua.
        let pmVerbPattern = #"\b(cenar|cenando|cenamos|cena|comer|comiendo|comamos|comida|almorzar|almorzando|almorzamos|almuerzo|almuerza|tomar\s+once)\b"#
        if lower.range(of: pmVerbPattern, options: .regularExpression) != nil {
            return .forcePM
        }

        return .neutral
    }

    private static func firstCaptureInt(_ text: String, pattern: String, group: Int) -> Int? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return nil }
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        guard let match = regex.firstMatch(in: text, range: range),
              match.numberOfRanges > group else { return nil }
        let r = match.range(at: group)
        guard r.location != NSNotFound else { return nil }
        return Int(ns.substring(with: r))
    }

    // MARK: - Pending clarification resolution

    /// Intenta resolver el siguiente turno usando un pending guardado por
    /// una clarify previa. Devuelve `nil` cuando el follow-up NO parece
    /// estar respondiendo a la pregunta (el caller debe fall-through).
    ///
    /// Heurísticas (en orden):
    /// 1. "no" / "cancela" / "déjalo" → cancelar pending, devolver smalltalk
    ///    suave ("Listo, lo dejo así.").
    /// 2. "sí" / "dale" / "confirma" → ejecutar acción si pending tiene
    ///    título + fecha + hora. Si falta algo, pedir lo que falta.
    /// 3. Solo hora ("a las 3" / "20:00" / "en 20 minutos"):
    ///       - Si pending.proposedDate existe, combinar hora con esa fecha.
    ///       - Si no, usar hoy (extractDateTime default).
    /// 4. Solo día ("mañana", "viernes"):
    ///       - Si pending.proposedTime ya estaba (por extractDateTime), crear.
    ///       - Si no, actualizar pending y volver a preguntar hora.
    /// 5. Día + hora juntos ("mañana a las 5") → crear con ambos.
    /// 6. Si el input claramente es una acción nueva (event trigger,
    ///    "tengo que", saludo), devolvemos nil para que el flujo normal lo
    ///    capture y descarte el pending.
    private static func resolvePendingFollowUp(
        trimmed: String,
        lower: String,
        wantsReminder: Bool,
        pending: PendingClarification
    ) -> NovaIntent? {
        // 6. Detección temprana de "nueva acción" — si el usuario claramente
        //    quiere hacer algo distinto (event trigger explícito, "tengo que",
        //    "crea tarea"), abandonamos el pending y dejamos que el flujo
        //    normal procese.
        if hasNewActionMarkers(lower) {
            return nil
        }

        // 1. Cancelación explícita.
        if isPendingCancel(lower) {
            return .smallTalk(reply: "Listo, lo dejo así.")
        }

        // 2. Confirmación afirmativa.
        if isPendingConfirm(lower) {
            return completePendingAsEvent(
                pending: pending,
                when: pending.proposedDate,
                wantsReminder: wantsReminder
            )
        }

        // 3-5. Extraer fecha/hora del follow-up y combinarla con pending.
        let extracted = extractDateTime(from: lower)
        let dayExplicit = hasExplicitDayMarker(lower)
        let timeExplicit = hasTimeMarker(lower)

        // Si el follow-up no aporta hora ni día y no es confirmación, no
        // hay forma de completar — devolvemos nil para fall-through.
        if !timeExplicit && !dayExplicit && extracted == nil {
            return nil
        }

        // Combinar: el día viene del input si fue explícito; si no, del
        // pending; si tampoco, hoy. La hora viene del input si fue explícita;
        // si no, del pending.proposedDate (sus h:m); si tampoco, default 9:00.
        let cal = Calendar.current
        let resolvedDate: Date? = combineDateAndTime(
            extracted: extracted,
            dayWasExplicit: dayExplicit,
            timeWasExplicit: timeExplicit,
            pendingDate: pending.proposedDate
        )

        guard let when = resolvedDate else {
            return nil
        }

        // Si después de combinar todavía no tenemos hora real (porque el
        // pending tampoco la tenía y el input solo aportó día), devolvemos
        // clarify pidiendo hora.
        if !timeExplicit && !pendingHadTime(pending: pending) {
            // El usuario eligió día; ahora falta hora.
            return .clarify(reason: .eventNeedsTime(title: pending.proposedTitle ?? "Tarea", partialDate: when))
        }

        _ = cal  // silenciar warning si no se usa más abajo
        return completePendingAsEvent(
            pending: pending,
            when: when,
            wantsReminder: wantsReminder
        )
    }

    /// Combina la fecha/hora del input con la del pending según qué fue
    /// explícito. Implementa la regla: input gana sobre pending para los
    /// campos que el input proveyó; pending llena los huecos.
    private static func combineDateAndTime(
        extracted: Date?,
        dayWasExplicit: Bool,
        timeWasExplicit: Bool,
        pendingDate: Date?
    ) -> Date? {
        let cal = Calendar.current
        // Caso fácil: input trae día+hora explícitos → usar input tal cual.
        if dayWasExplicit && timeWasExplicit, let extracted {
            return extracted
        }
        // Caso fácil 2: input trae solo hora, pending tiene día → tomar
        // día del pending y hora del input.
        if timeWasExplicit, let extracted, let pendingDate {
            let h = cal.component(.hour, from: extracted)
            let m = cal.component(.minute, from: extracted)
            let baseDay = cal.startOfDay(for: pendingDate)
            return cal.date(bySettingHour: h, minute: m, second: 0, of: baseDay)
        }
        // Solo hora, sin pending → usar `extracted` (será hoy + h:m).
        if timeWasExplicit, let extracted {
            return extracted
        }
        // Solo día, pending tiene hora → cambiar el día del pending al nuevo.
        if dayWasExplicit, let extracted, let pendingDate {
            let h = cal.component(.hour, from: pendingDate)
            let m = cal.component(.minute, from: pendingDate)
            let baseDay = cal.startOfDay(for: extracted)
            return cal.date(bySettingHour: h, minute: m, second: 0, of: baseDay)
        }
        // Solo día, sin pending o pending sin hora → devolver día (con 9:00
        // default que viene de extractDateTime). Caller decidirá si pide hora.
        if dayWasExplicit {
            return extracted
        }
        // Ninguno explícito → no hay nada para combinar.
        return extracted
    }

    /// True cuando el pending ya tenía una hora "real" (no el 9:00 default
    /// que devuelve `extractDateTime` cuando solo había día).
    private static func pendingHadTime(pending: PendingClarification) -> Bool {
        guard let date = pending.proposedDate else { return false }
        // Si proposedDate tiene hora distinta de 9:00 exacto, asumimos
        // que es una hora real (no el default).
        let cal = Calendar.current
        let h = cal.component(.hour, from: date)
        let m = cal.component(.minute, from: date)
        return !(h == 9 && m == 0)
    }

    /// True si el input incluye día explícito (hoy/mañana/pasado mañana/
    /// día de la semana).
    private static func hasExplicitDayMarker(_ lower: String) -> Bool {
        if lower.range(of: #"\bma(ñ|n)ana\b"#, options: .regularExpression) != nil { return true }
        if lower.contains("hoy") { return true }
        if lower.contains("pasado mañana") || lower.contains("pasado manana") { return true }
        if nextWeekday(in: lower, calendar: .current, from: Date()) != nil { return true }
        return false
    }

    /// True si el input parece arrancar una nueva acción (no completar el
    /// pending). Detección conservadora: solo descartamos pending si el
    /// usuario claramente empezó algo nuevo.
    private static func hasNewActionMarkers(_ lower: String) -> Bool {
        let eventStarters = [
            "agenda ", "agéndame", "agendame", "agendar ",
            "crea evento", "crea un evento", "nuevo evento",
            "tengo reunión", "tengo reunion", "tengo clase",
            "tengo prueba", "tengo parcial", "tengo examen", "tengo final",
            "tengo entrega", "tengo cita", "tengo turno", "tengo médico",
            "tengo medico", "tengo doctor", "tengo evento",
            "salir a ", "salir con ", "ir a ", "voy a ",
            "buscar a ", "ir a buscar ",
            "reunión con ", "reunion con ",
            "juntarme con ", "almuerzo con ", "cena con ",
            "tengo que ", "crea tarea", "nueva tarea",
            "comprar ", "llamar ", "estudiar ", "leer ", "escribir ",
            "organiza mi día", "organiza el día",
            "qué tengo", "que tengo", "qué sigue", "que sigue"
        ]
        return matchesAny(lower, eventStarters)
    }

    /// Patrones de respuesta afirmativa corta.
    private static func isPendingConfirm(_ lower: String) -> Bool {
        let confirm: Set<String> = [
            "sí", "si", "sí.", "si.", "sí!", "si!",
            "dale", "dale!",
            "confirma", "confírma", "confírmalo", "confirmalo",
            "ok", "okay", "vale", "perfecto", "listo",
            "claro", "claro que sí", "claro que si",
            "así está bien", "asi esta bien", "así es", "asi es"
        ]
        return confirm.contains(lower)
    }

    /// Patrones de cancelación corta.
    private static func isPendingCancel(_ lower: String) -> Bool {
        let cancel: Set<String> = [
            "no", "no,", "no.",
            "cancela", "cancelar", "cancélalo", "cancelalo",
            "déjalo", "dejalo", "déjalo así", "dejalo asi",
            "olvídalo", "olvidalo", "olvídate", "olvidate",
            "no importa", "nada", "mejor no"
        ]
        return cancel.contains(lower)
    }

    /// Construye un `NovaIntent` usando el pending + when final.
    /// - pending.kind == .task → createTask con dueDate=when.
    /// - resto → createEvent (con isReminder según wantsReminder).
    private static func completePendingAsEvent(
        pending: PendingClarification,
        when: Date?,
        wantsReminder: Bool
    ) -> NovaIntent {
        let title = pending.proposedTitle ?? "Recordatorio"
        let combinedReminder = wantsReminder || pending.wantsReminder

        // Tarea explícita: respetar el kind original del pending.
        if pending.kind == .task {
            return .createTask(
                title: title,
                dueDate: when,
                recurrence: nil,
                wantsReminder: combinedReminder
            )
        }

        // Sin fecha resuelta no podemos crear evento — pedir hora.
        guard let when else {
            return .clarify(reason: .eventNeedsTime(title: title, partialDate: Date()))
        }

        return .createEvent(
            title: title,
            when: when,
            endTime: nil,
            location: pending.proposedLocation,
            section: pending.proposedSection,
            wantsReminder: combinedReminder
        )
    }

    private static func extractLocation(from text: String) -> String? {
        // Busca " en <X>" donde X termina en fin/coma/punto/salto-de-línea.
        // Acepta tildes y mayúsculas (case-insensitive).
        guard let range = text.range(
            of: #"(?i)(^|\s)en\s+([^.,;\n]+)"#,
            options: .regularExpression
        ) else { return nil }
        let chunk = String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
        // Quita el prefijo "en " (puede tener acento por ejemplo "En ")
        let withoutPrefix = chunk
            .replacingOccurrences(of: #"^(?i)en\s+"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !withoutPrefix.isEmpty else { return nil }
        // Rechazo de "ubicaciones" que son en realidad expresiones horarias:
        // "en 20" / "en 20 minutos" / "en 2 horas" / "en 20 hrs" — son tiempo,
        // no lugar. Sin este filtro, FocusEvent.location quedaría con "20".
        if withoutPrefix.range(
            of: #"^\d{1,3}(\s+(min|minutos?|h|hs|hrs?|horas?))?$"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil {
            return nil
        }
        return cleanupTitle(withoutPrefix)
    }

}

/// Store central de la app. Carga desde persistencia local con fallback a demo state.
///
/// Persistencia:
/// - `events` / `tasks`: inician vacíos por diseño (la UI muestra ejemplos hasta que el
///   usuario cree el primero). Si hay datos guardados, se cargan.
/// - `suggestions` / `novaMessages`: fallback a DemoDataProvider si no hay datos guardados,
///   para que la app tenga vida desde el primer launch.
/// - `settings`: fallback a `.defaults`.
///
/// Guardado: solo en mutaciones explícitas (helpers `persist*()`). Nunca en computed
/// properties ni en cada body render — evita loops de SwiftUI.
@MainActor
final class FocusDataStore: ObservableObject {
    @Published var events: [FocusEvent]
    @Published var tasks: [FocusTask]
    @Published var suggestions: [NovaSuggestion]
    @Published var novaMessages: [NovaMessage]
    @Published var settings: AppSettings
    /// Memoria de sesión para Nova. NO persiste a disco — se reinicia con
    /// cada launch. Permite resolver "agéndalo X" o "y X" usando el último
    /// intent procesado.
    @Published var novaContext: NovaContext = NovaContext()
    /// True mientras Nova "tipea" la respuesta. Se usa en el Chat para
    /// mostrar el indicador de 3 puntos.
    @Published var isNovaTyping: Bool = false

    // MARK: - Sync state (Bloque 3 — Supabase events/tasks)

    /// Credenciales para sync. `FocusApp` las inyecta cada vez que cambia
    /// `AuthStore.state`. Cuando es nil → modo demo o logged-out → NO sync.
    /// Cuando hay valor → store dispara fetch + upserts en background.
    struct SyncCredentials: Equatable {
        let accessToken: String
        let userId: UUID
    }
    @Published var syncCredentials: SyncCredentials? = nil

    /// Estado visible para Ajustes → "Sincronización".
    enum SyncState: Equatable {
        case demo                       // Sin sesión → no sync
        case loggedOut                  // Logueado pero credenciales aún no llegan
        case idle                       // Logueado, no hay sync corriendo
        case syncing                    // Hay fetch/upsert activo
        case error(String)              // Última sync falló
    }
    @Published var syncState: SyncState = .demo
    @Published var lastSyncAt: Date? = nil
    /// Títulos de ítems demo descartados por el usuario. **Sí persisten** a
    /// disco — si el usuario hace swipe-borrar a un ejemplo, no debe volver
    /// a aparecer al reabrir la app. Solo aplica cuando `!hasUserData`.
    @Published var dismissedDemoEventTitles: Set<String>
    @Published var dismissedDemoTaskTitles: Set<String>

    /// IDs de items que el usuario borró localmente pero cuya soft-delete
    /// remota puede haber fallado (sin red, error transitorio). Persiste a
    /// disco; en cada `fetchRemoteAndMerge` reintentamos la soft-delete y,
    /// si el remoto todavía devuelve el ítem, lo excluimos del merge así
    /// no "revive" en la UI.
    @Published private(set) var pendingDeleteEventIds: Set<UUID>
    @Published private(set) var pendingDeleteTaskIds: Set<UUID>

    init() {
        self.events = FocusLocalStore.load([FocusEvent].self, forKey: .events) ?? []
        self.tasks = FocusLocalStore.load([FocusTask].self, forKey: .tasks) ?? []

        // Sugerencias: NO pre-seedeamos demo en el store. Las demos viven
        // solo como fallback dinámico en `displaySuggestions` cuando no hay
        // datos del usuario. Esto evita que queden "stale" referenciando
        // tareas/eventos inexistentes.
        //
        // Migración (one-shot): si el usuario tiene sugerencias persistidas
        // que coinciden por título con el seed demo legacy y siguen en
        // `.pending`, las purgamos. Las creadas por quick actions de Nova
        // (organizar, preparar mañana, etc.) tienen títulos distintos y
        // sobreviven.
        let legacyDemoSeedTitles = Set(DemoDataProvider.shared.suggestions().map(\.title))
        var loadedSuggestions = FocusLocalStore.load([NovaSuggestion].self, forKey: .suggestions) ?? []
        loadedSuggestions.removeAll { sug in
            legacyDemoSeedTitles.contains(sug.title) && sug.status == .pending
        }
        self.suggestions = loadedSuggestions

        // Chat arranca vacío para que aparezca el empty-state estilo Gemini
        // ("¿Qué quieres ordenar?" + chips). El mensaje de bienvenida vive
        // solo en la UI cuando no hay historial.
        self.novaMessages = FocusLocalStore.load([NovaMessage].self, forKey: .novaMessages) ?? []
        self.settings = FocusLocalStore.load(AppSettings.self, forKey: .settings)
            ?? .defaults

        // Descartes de demo: cargar persistidos para que sobrevivan al cierre
        // de app. Si el usuario borró un ejemplo, no debe volver al reabrir.
        let storedDismissedEvents = FocusLocalStore.load([String].self, forKey: .dismissedDemoEvents) ?? []
        let storedDismissedTasks = FocusLocalStore.load([String].self, forKey: .dismissedDemoTasks) ?? []
        self.dismissedDemoEventTitles = Set(storedDismissedEvents)
        self.dismissedDemoTaskTitles = Set(storedDismissedTasks)

        // Cola persistente de soft-deletes pendientes. Si la app se mata
        // antes de confirmar el delete remoto, lo retomamos en el próximo
        // fetch+merge.
        let pendingEvtIds = FocusLocalStore.load([UUID].self, forKey: .pendingDeleteEvents) ?? []
        let pendingTaskIds = FocusLocalStore.load([UUID].self, forKey: .pendingDeleteTasks) ?? []
        self.pendingDeleteEventIds = Set(pendingEvtIds)
        self.pendingDeleteTaskIds = Set(pendingTaskIds)
    }

    private func persistPendingDeleteEvents() {
        FocusLocalStore.save(Array(pendingDeleteEventIds), forKey: .pendingDeleteEvents)
    }
    private func persistPendingDeleteTasks() {
        FocusLocalStore.save(Array(pendingDeleteTaskIds), forKey: .pendingDeleteTasks)
    }

    private func persistDismissedDemoEvents() {
        FocusLocalStore.save(Array(dismissedDemoEventTitles), forKey: .dismissedDemoEvents)
    }
    private func persistDismissedDemoTasks() {
        FocusLocalStore.save(Array(dismissedDemoTaskTitles), forKey: .dismissedDemoTasks)
    }

    func dismissDemoEvent(title: String) {
        dismissedDemoEventTitles.insert(title)
        persistDismissedDemoEvents()
    }
    func dismissDemoTask(title: String) {
        dismissedDemoTaskTitles.insert(title)
        persistDismissedDemoTasks()
    }

    // MARK: - Nova context (memoria de sesión)

    /// Actualiza el contexto después de procesar un intent. Permite que el
    /// siguiente turno resuelva referencias ("agéndalo como tarea") sin
    /// pedirle al usuario que repita.
    func updateNovaContext(
        from input: String,
        title: String,
        date: Date? = nil,
        location: String? = nil,
        section: EventSection? = nil,
        kind: NovaContext.Kind,
        eventId: UUID? = nil,
        taskId: UUID? = nil
    ) {
        novaContext = NovaContext(
            lastInputText: input,
            lastTitle: title,
            lastDate: date,
            lastLocation: location,
            lastSection: section,
            lastIntentKind: kind,
            lastEventId: eventId,
            lastTaskId: taskId,
            pendingClarification: nil,
            updatedAt: Date()
        )
    }

    /// Guarda una aclaración pendiente. El siguiente turno del usuario
    /// (corto: solo hora, solo día, "sí", "no", etc.) puede usar este
    /// pending para completar la acción sin perder contexto.
    func setPendingClarification(_ pending: PendingClarification) {
        var ctx = novaContext
        ctx.pendingClarification = pending
        ctx.updatedAt = Date()
        novaContext = ctx
    }

    /// Limpia solo el pending sin tocar el resto del contexto.
    func clearPendingClarification() {
        guard novaContext.pendingClarification != nil else { return }
        var ctx = novaContext
        ctx.pendingClarification = nil
        novaContext = ctx
    }

    func clearNovaContext() {
        novaContext = NovaContext()
    }

    // MARK: - Sync coordination (called by FocusApp on auth changes)

    /// Llamar desde `FocusApp` cuando cambia `AuthStore.state`. Solo si hay
    /// `accessToken` + `userId` válidos, se sincroniza. Cualquier otra cosa
    /// (demo, loggedOut) deja `syncCredentials = nil` → no hay sync.
    func applyAuthChange(accessToken: String?, userId: UUID?) {
        guard let accessToken, let userId else {
            syncCredentials = nil
            syncState = .demo
            return
        }
        let creds = SyncCredentials(accessToken: accessToken, userId: userId)
        let changed = syncCredentials != creds
        syncCredentials = creds
        if syncState == .demo || syncState == .loggedOut {
            syncState = .idle
        }
        // Si cambiaron credenciales (login nuevo o refresh), traemos remoto.
        if changed {
            Task { [weak self] in await self?.fetchRemoteAndMerge() }
        }
    }

    /// Fetch remoto + merge con local. Estrategia V1: server wins por
    /// `updated_at` cuando hay conflicto. Items locales sin contraparte
    /// remota se suben (defensa contra primer-login con datos preexistentes).
    func fetchRemoteAndMerge() async {
        guard let creds = syncCredentials else { return }
        syncState = .syncing
        do {
            async let remoteEvents = SupabaseSyncService.fetchEvents(
                accessToken: creds.accessToken, userId: creds.userId.uuidString
            )
            async let remoteTasks = SupabaseSyncService.fetchTasks(
                accessToken: creds.accessToken, userId: creds.userId.uuidString
            )
            let (events, tasks) = try await (remoteEvents, remoteTasks)
            await MainActor.run {
                mergeRemoteEvents(events)
                mergeRemoteTasks(tasks)
                lastSyncAt = Date()
                syncState = .idle
            }
        } catch let err as SupabaseSyncError {
            await MainActor.run {
                syncState = .error(err.errorDescription ?? "Sync error")
            }
        } catch {
            await MainActor.run {
                syncState = .error(error.localizedDescription)
            }
        }
    }

    /// Merge in-place: server gana por id; locales sin contraparte se
    /// preservan (luego pasamos a uploadPendingLocals para subirlos).
    /// Excluye items que estén en `pendingDeleteEventIds` — el usuario los
    /// borró pero el remoto puede no haberse confirmado todavía. Si el
    /// remoto aún los devuelve, reintentamos la soft-delete asíncronamente.
    private func mergeRemoteEvents(_ remote: [RemoteFocusEvent]) {
        var byId = Dictionary(uniqueKeysWithValues: events.map { ($0.id, $0) })
        // Quitar primero los que el usuario ya borró localmente — defensa
        // contra "revivir" eventos cuando el delete remoto falló por red.
        for id in pendingDeleteEventIds { byId.removeValue(forKey: id) }

        var idsToRetryDelete: [UUID] = []
        for r in remote {
            guard let local = r.toLocal() else { continue }
            if pendingDeleteEventIds.contains(local.id) {
                idsToRetryDelete.append(local.id)
                continue
            }
            byId[local.id] = local
        }
        events = byId.values.sorted { $0.startTime < $1.startTime }
        persistEvents()
        // Re-sync notificaciones locales: si algún evento remoto trajo un
        // recordatorio futuro nuevo, lo programamos. Identifiers estables
        // por id → no duplica para los que ya estaban programados.
        resyncAllLocalNotifications()
        // Reintentar soft-deletes pendientes que el servidor todavía
        // muestra (probablemente el primer intento falló por red).
        for id in idsToRetryDelete { softDeleteEventRemote(id) }
    }

    private func mergeRemoteTasks(_ remote: [RemoteFocusTask]) {
        var byId = Dictionary(uniqueKeysWithValues: tasks.map { ($0.id, $0) })
        for id in pendingDeleteTaskIds { byId.removeValue(forKey: id) }

        var idsToRetryDelete: [UUID] = []
        for r in remote {
            if pendingDeleteTaskIds.contains(r.id) {
                idsToRetryDelete.append(r.id)
                continue
            }
            byId[r.id] = r.toLocal()
        }
        tasks = Array(byId.values)
        persistTasks()
        for id in idsToRetryDelete { softDeleteTaskRemote(id) }
    }

    /// Background upsert. Si falla, deja `syncState = .error` pero NO
    /// reverte el cambio local — la consistencia se restaura en la próxima
    /// sync exitosa.
    private func uploadEvent(_ event: FocusEvent) {
        guard let creds = syncCredentials else { return }
        Task { [weak self] in
            do {
                let remote = RemoteFocusEvent(local: event, userId: creds.userId)
                try await SupabaseSyncService.upsertEvent(remote, accessToken: creds.accessToken)
                await MainActor.run {
                    // Si veníamos arrastrando un .error transitorio, lo
                    // normalizamos en cuanto vuelve un upload exitoso.
                    if case .error = self?.syncState { self?.syncState = .idle }
                }
            } catch let err as SupabaseSyncError {
                await MainActor.run {
                    self?.syncState = .error(err.errorDescription ?? "Sync error")
                }
            } catch {
                await MainActor.run {
                    self?.syncState = .error(error.localizedDescription)
                }
            }
        }
    }

    private func uploadTask(_ task: FocusTask) {
        guard let creds = syncCredentials else { return }
        Task { [weak self] in
            do {
                let remote = RemoteFocusTask(local: task, userId: creds.userId)
                try await SupabaseSyncService.upsertTask(remote, accessToken: creds.accessToken)
                await MainActor.run {
                    if case .error = self?.syncState { self?.syncState = .idle }
                }
            } catch let err as SupabaseSyncError {
                await MainActor.run {
                    self?.syncState = .error(err.errorDescription ?? "Sync error")
                }
            } catch {
                await MainActor.run {
                    self?.syncState = .error(error.localizedDescription)
                }
            }
        }
    }

    private func softDeleteEventRemote(_ id: UUID) {
        guard let creds = syncCredentials else { return }
        Task { [weak self] in
            do {
                try await SupabaseSyncService.softDeleteEvent(id: id, accessToken: creds.accessToken)
                await MainActor.run {
                    // Confirmado en remoto: lo sacamos de la cola pendiente
                    // y, si era el último error, normalizamos el estado.
                    self?.pendingDeleteEventIds.remove(id)
                    self?.persistPendingDeleteEvents()
                    if case .error = self?.syncState { self?.syncState = .idle }
                }
            } catch let err as SupabaseSyncError {
                await MainActor.run {
                    self?.syncState = .error(err.errorDescription ?? "Sync error")
                }
            } catch {
                await MainActor.run {
                    self?.syncState = .error(error.localizedDescription)
                }
            }
        }
    }

    private func softDeleteTaskRemote(_ id: UUID) {
        guard let creds = syncCredentials else { return }
        Task { [weak self] in
            do {
                try await SupabaseSyncService.softDeleteTask(id: id, accessToken: creds.accessToken)
                await MainActor.run {
                    self?.pendingDeleteTaskIds.remove(id)
                    self?.persistPendingDeleteTasks()
                    if case .error = self?.syncState { self?.syncState = .idle }
                }
            } catch let err as SupabaseSyncError {
                await MainActor.run {
                    self?.syncState = .error(err.errorDescription ?? "Sync error")
                }
            } catch {
                await MainActor.run {
                    self?.syncState = .error(error.localizedDescription)
                }
            }
        }
    }

    // MARK: - Persistencia (privado)

    private func persistEvents()       { FocusLocalStore.save(events, forKey: .events) }
    private func persistTasks()        { FocusLocalStore.save(tasks, forKey: .tasks) }
    private func persistSuggestions()  { FocusLocalStore.save(suggestions, forKey: .suggestions) }
    private func persistNovaMessages() { FocusLocalStore.save(novaMessages, forKey: .novaMessages) }
    private func persistSettings()     { FocusLocalStore.save(settings, forKey: .settings) }

    // MARK: - Estado: usuario ya creó algo?

    var hasUserData: Bool {
        !events.isEmpty || !tasks.isEmpty
    }

    var hasUserEvents: Bool {
        !events.isEmpty
    }

    var hasUserTasks: Bool {
        !tasks.isEmpty
    }

    /// True solo cuando el usuario NO está logueado — sin `syncCredentials`,
    /// la app está en modo demo. Los ejemplos del Calendario/Mi Día/Tareas
    /// SOLO deben aparecer en este modo. Un usuario logueado con 0 ítems
    /// debe ver estado vacío real, NO eventos demo falsos.
    var isInDemoMode: Bool {
        syncCredentials == nil
    }

    // MARK: - Eventos

    func eventsFor(date target: Date) -> [FocusEvent] {
        let cal = Calendar.current
        return events
            .filter { cal.isDate($0.startTime, inSameDayAs: target) }
            .sorted { $0.startTime < $1.startTime }
    }

    func todayEvents() -> [FocusEvent] {
        eventsFor(date: Date())
    }

    /// Recordatorios puntuales de hoy cuya hora ya pasó y NO fueron
    /// "completados" (eliminar = completar — V1 sin estado done para
    /// eventos). Los usamos para mostrar una sección "Vencidos" en
    /// Mi Día separada del timeline regular.
    func overdueRemindersToday() -> [FocusEvent] {
        let now = Date()
        return todayEvents().filter { event in
            event.isReminder == true && event.startTime < now
        }
    }

    /// Eventos de hoy que NO son recordatorios vencidos — el timeline
    /// "normal" de Mi Día y Calendario.
    func upcomingAndCurrentEventsToday() -> [FocusEvent] {
        let now = Date()
        return todayEvents().filter { event in
            // Recordatorio vencido → fuera del timeline normal.
            if event.isReminder == true, event.startTime < now {
                return false
            }
            return true
        }
    }

    var nextBlock: FocusEvent? {
        let now = Date()
        return upcomingAndCurrentEventsToday().first { event in
            // Para recordatorios usamos solo startTime (no endTime interno
            // de 5min que mentía y los hacía aparecer como "próximo bloque"
            // hasta 5 min después de su hora real).
            if event.isReminder == true {
                return event.startTime >= now
            }
            return (event.endTime ?? event.startTime) >= now
        }
    }

    func addEvent(_ event: FocusEvent) {
        events.append(event)
        events.sort { $0.startTime < $1.startTime }
        persistEvents()
        uploadEvent(event)
        syncLocalNotification(for: event)
        HapticManager.shared.success()
    }

    func deleteEvent(_ id: UUID) {
        // ORDEN CRÍTICO: persistir la intención de borrar ANTES de
        // persistir el array de eventos. Si la app se mata entre
        // `persistEvents` y `persistPendingDeleteEvents`, al relanzarse
        // tendríamos events.json sin el ítem PERO pendingDelete sin la
        // id, y el próximo `fetchRemoteAndMerge` lo resucitaría desde
        // Supabase. Persistiendo pendingDelete primero, el merge SIEMPRE
        // lo excluye aunque crashee al medio.
        if syncCredentials != nil {
            pendingDeleteEventIds.insert(id)
            persistPendingDeleteEvents()
        }
        events.removeAll { $0.id == id }
        persistEvents()
        cleanupStaleSuggestions()
        softDeleteEventRemote(id)
        // Cancelar notificación local SIEMPRE — si no existía, no-op.
        LocalNotificationService.shared.cancelReminder(eventId: id)
    }

    /// Actualiza un evento existente. No falla silenciosamente si el id no
    /// existe — solo no hace nada.
    func updateEvent(_ event: FocusEvent) {
        guard let idx = events.firstIndex(where: { $0.id == event.id }) else { return }
        events[idx] = event
        events.sort { $0.startTime < $1.startTime }
        persistEvents()
        uploadEvent(event)
        syncLocalNotification(for: event)
        HapticManager.shared.tick()
    }

    /// Re-sincroniza la notificación local para `event`. Tres ramas:
    /// - `isReminder == true` + `startTime > now` + permisos OK + toggle ON →
    ///   programa (idempotente, reemplaza pendiente anterior).
    /// - Cualquier otro caso → cancela la pendiente si existía (cubre el
    ///   flujo "evento dejó de ser recordatorio" o "se movió al pasado").
    ///
    /// Si el toggle está apagado o falta permiso, cancelamos cualquier
    /// pendiente sobrante — así el usuario que apaga el switch deja de ver
    /// alertas inmediatamente.
    private func syncLocalNotification(for event: FocusEvent) {
        // No es recordatorio o ya pasó → cancel y listo.
        guard event.isReminder == true, event.startTime > Date() else {
            LocalNotificationService.shared.cancelReminder(eventId: event.id)
            return
        }
        // Toggle global apagado → cancel todo lo nuestro y no schedule más.
        guard settings.remindersEnabled else {
            LocalNotificationService.shared.cancelReminder(eventId: event.id)
            return
        }
        Task { [event] in
            let status = await LocalNotificationService.shared.currentStatus()
            switch status {
            case .authorized, .provisional, .ephemeral:
                await LocalNotificationService.shared.scheduleReminder(for: event)
            case .notDetermined:
                // Pedimos permiso una sola vez. Si el usuario acepta,
                // programamos. Si rechaza, queda el evento sin alerta —
                // Ajustes mostrará el estado y dará botón para activar.
                let resolved = await LocalNotificationService.shared.requestAuthorization()
                if resolved == .authorized || resolved == .provisional {
                    await LocalNotificationService.shared.scheduleReminder(for: event)
                }
            case .denied:
                // El usuario rechazó antes. No hacemos nada — Ajustes
                // mostrará "denegadas" + botón para abrir Settings del iPhone.
                break
            @unknown default:
                break
            }
        }
    }

    /// Re-sincroniza notificaciones para TODOS los eventos vigentes. Se
    /// llama al final de `mergeRemoteEvents` para asegurar que cualquier
    /// evento traído de Supabase con `isReminder=true` tenga notificación
    /// local programada (los identifiers son estables por id, así que no
    /// duplica).
    private func resyncAllLocalNotifications() {
        for event in events where event.isReminder == true && event.startTime > Date() {
            syncLocalNotification(for: event)
        }
    }

    /// Llamado por `FocusApp` al arrancar — asegura que recordatorios
    /// futuros tengan sus notificaciones programadas. iOS no garantiza
    /// persistir notificaciones locales tras reinstalar la app, así que
    /// esto cubre el caso. Idempotente: identifiers estables por id.
    func bootstrapLocalNotifications() {
        guard settings.remindersEnabled else { return }
        resyncAllLocalNotifications()
    }

    // MARK: - Tareas

    func tasksIn(_ category: TaskCategory) -> [FocusTask] {
        tasks.filter { $0.category == category }
    }

    var pendingTodayTasks: [FocusTask] {
        tasks.filter { $0.category == .hoy && !$0.done }
    }

    func toggleTask(_ id: UUID) {
        guard let idx = tasks.firstIndex(where: { $0.id == id }) else { return }
        tasks[idx].done.toggle()
        tasks[idx].doneAt = tasks[idx].done ? Date() : nil
        persistTasks()
        uploadTask(tasks[idx])
        if tasks[idx].done {
            HapticManager.shared.success()
        } else {
            HapticManager.shared.tick()
        }
    }

    func toggleSubtask(taskId: UUID, subtaskId: UUID) {
        guard let tIdx = tasks.firstIndex(where: { $0.id == taskId }) else { return }
        guard let sIdx = tasks[tIdx].subtasks.firstIndex(where: { $0.id == subtaskId }) else { return }
        tasks[tIdx].subtasks[sIdx].isCompleted.toggle()
        persistTasks()
        uploadTask(tasks[tIdx])
        HapticManager.shared.tick()
    }

    func addTask(_ task: FocusTask) {
        tasks.insert(task, at: 0)
        persistTasks()
        uploadTask(task)
        HapticManager.shared.success()
    }

    func deleteTask(_ id: UUID) {
        // Mismo orden defensivo que deleteEvent: pendingDelete persist
        // ANTES que tasks persist, para que un crash entre los dos no
        // resucite la tarea al relanzar.
        if syncCredentials != nil {
            pendingDeleteTaskIds.insert(id)
            persistPendingDeleteTasks()
        }
        tasks.removeAll { $0.id == id }
        persistTasks()
        cleanupStaleSuggestions()
        softDeleteTaskRemote(id)
        HapticManager.shared.tick()
    }

    /// Actualiza una tarea existente. Si el id no existe, no hace nada.
    func updateTask(_ task: FocusTask) {
        guard let idx = tasks.firstIndex(where: { $0.id == task.id }) else { return }
        tasks[idx] = task
        persistTasks()
        uploadTask(task)
        HapticManager.shared.tick()
    }

    // MARK: - Sugerencias

    /// Sugerencias visibles en la Bandeja:
    /// 1. Filtra del store las que referencian items que ya no existen.
    /// 2. Si quedan, las muestra.
    /// 3. Si NO quedan y el usuario NO tiene datos reales todavía
    ///    (modo demo limpio), cae a las sugerencias de ejemplo dinámicas.
    /// 4. Si NO quedan y el usuario YA creó algo real, vacío total.
    var displaySuggestions: [NovaSuggestion] {
        let valid = suggestions.filter { sug in
            if let id = sug.relatedTaskId, !tasks.contains(where: { $0.id == id }) {
                return false
            }
            if let id = sug.relatedEventId, !events.contains(where: { $0.id == id }) {
                return false
            }
            return true
        }
        if !valid.isEmpty { return valid }
        if hasUserData { return [] }
        // Solo mostrar sugerencias demo en modo demo (no logueado). Una
        // cuenta real sin ítems propios ve vacío real.
        guard isInDemoMode else { return [] }
        return DemoDataProvider.shared.suggestions()
    }

    /// Pendientes que se muestran a la UI (incluye fallback de demo). Es lo
    /// que usan el badge de Nova y el chevron en Mi Día.
    var pendingDisplaySuggestions: [NovaSuggestion] {
        displaySuggestions.filter { $0.status == .pending }
    }

    /// Solo las pendientes REALES del store (sin fallback). Para lógica
    /// interna que no quiere mezclar demo.
    var pendingSuggestions: [NovaSuggestion] {
        suggestions.filter { $0.status == .pending }
    }

    /// Elimina del store cualquier sugerencia que referencia un task/event
    /// que ya no existe. Llamada después de borrar items o resetear demo
    /// para mantener la Bandeja consistente.
    func cleanupStaleSuggestions() {
        let before = suggestions.count
        suggestions.removeAll { sug in
            if let id = sug.relatedTaskId, !tasks.contains(where: { $0.id == id }) {
                return true
            }
            if let id = sug.relatedEventId, !events.contains(where: { $0.id == id }) {
                return true
            }
            return false
        }
        if suggestions.count != before { persistSuggestions() }
    }

    func updateSuggestion(_ id: UUID, status: SuggestionStatus) {
        guard let idx = suggestions.firstIndex(where: { $0.id == id }) else { return }
        suggestions[idx].status = status
        suggestions[idx].resolvedAt = Date()
        persistSuggestions()
        if status == .approved {
            HapticManager.shared.success()
        } else {
            HapticManager.shared.tick()
        }
    }

    /// Agrega una sugerencia nueva a la bandeja (pending). Persiste.
    func addSuggestion(_ suggestion: NovaSuggestion) {
        suggestions.insert(suggestion, at: 0)
        persistSuggestions()
    }

    /// Resultado de aprobar una sugerencia — la UI usa esto para mostrar el
    /// toast correcto ("Evento creado", "Tarea creada", "Sugerencia aprobada").
    enum SuggestionApprovalResult {
        case eventCreated(FocusEvent)
        case taskCreated(FocusTask)
        case acknowledged
    }

    /// Aprueba una sugerencia y, según su tipo, crea la entidad asociada:
    /// - `.schedule` → evento real en la agenda.
    /// - `.task` → tarea en pendientes.
    /// - resto → solo cambia estado a `.approved`.
    /// Retorna el resultado para que la UI muestre feedback adecuado.
    @discardableResult
    func approveSuggestion(_ id: UUID) -> SuggestionApprovalResult {
        guard let idx = suggestions.firstIndex(where: { $0.id == id }) else {
            return .acknowledged
        }
        let sug = suggestions[idx]
        suggestions[idx].status = .approved
        suggestions[idx].resolvedAt = Date()
        persistSuggestions()
        HapticManager.shared.success()

        switch sug.kind {
        case .schedule:
            // Crea un evento en la próxima hora redonda con 1h de duración.
            // Es ad-hoc: cuando Nova real esté conectada, la propuesta vendrá
            // con startTime/endTime sugeridos.
            let cal = Calendar.current
            let now = Date()
            let nextHour = cal.date(
                bySettingHour: cal.component(.hour, from: now) + 1,
                minute: 0,
                second: 0,
                of: now
            ) ?? now
            let endHour = cal.date(byAdding: .hour, value: 1, to: nextHour) ?? nextHour
            let event = FocusEvent(
                title: sug.suggestedAction,
                notes: sug.detail,
                startTime: nextHour,
                endTime: endHour,
                section: .foco
            )
            addEvent(event)
            suggestions[idx].relatedEventId = event.id
            persistSuggestions()
            return .eventCreated(event)

        case .task:
            let task = FocusTask(
                title: sug.suggestedAction,
                notes: sug.detail,
                priority: sug.priority == .high ? .alta : .media,
                category: .hoy
            )
            addTask(task)
            suggestions[idx].relatedTaskId = task.id
            persistSuggestions()
            return .taskCreated(task)

        case .rebalance, .break_, .prep:
            return .acknowledged
        }
    }

    // MARK: - Nova — backend actions

    /// Resultado de aplicar `[BackendAction]` al store. La UI usa esto para
    /// mostrar resúmenes claros ("Evento creado", "Tarea actualizada", etc.)
    /// y para saber a qué pantalla saltar.
    struct NovaApplyOutcome {
        /// True cuando se ejecutó al menos una mutación real (excluye
        /// `remember` que es transparente). Si es false, el caller debe
        /// mostrar solo el `reply` textual del backend.
        var didMutate: Bool = false
        /// Resumen humano de la última mutación, listo para inline response.
        var summary: String? = nil
        /// Acciones ignoradas/strippadas — para diagnóstico en logs.
        var ignored: [String] = []
        /// ID del evento creado o editado en esta tanda (si aplica). Para
        /// que el caller pueda saltar a Calendario / abrir detail.
        var primaryEventId: UUID? = nil
        /// ID de la tarea creada o editada en esta tanda (si aplica).
        var primaryTaskId: UUID? = nil
        /// Si la acción primaria fue un recordatorio puntual.
        var primaryIsReminder: Bool = false
    }

    /// Aplica una secuencia de `BackendAction` al store. Cada mutación
    /// pasa por los métodos existentes (`addEvent`, `updateEvent`, ...)
    /// que ya sincronizan con Supabase. Diseñado para correr en main actor
    /// (este store ya es @MainActor).
    ///
    /// Reglas:
    /// - `add_recurring_event` se expande localmente a N `addEvent` (1..count).
    /// - `edit_event` / `delete_event` con id que no matchea ningún evento
    ///   local quedan registrados en `ignored` (no crashea).
    /// - `remember` se ignora en V1 (no hay memory store local todavía).
    /// - `unsupported(typeName)` queda registrado en `ignored`.
    func applyBackendActions(
        _ actions: [BackendAction],
        userText: String
    ) -> NovaApplyOutcome {
        var outcome = NovaApplyOutcome()

        for action in actions {
            switch action {
            case .addEvent(let payload):
                if let event = makeEvent(from: payload, userText: userText) {
                    // Anti-duplicado en el path del backend. El local path
                    // ya tenía esta defensa; ahora la centralizamos también
                    // acá para casos donde el backend genere la acción
                    // (retry, doble tap, sesión recuperada).
                    if NovaActionNormalizer.isLikelyDuplicate(
                        title: event.title,
                        startTime: event.startTime,
                        existingEvents: events
                    ) {
                        outcome.didMutate = false
                        outcome.summary = "Ya tenías «\(event.title)» a esa hora — no lo dupliqué."
                        outcome.ignored.append("add_event(duplicate)")
                    } else {
                        addEvent(event)
                        outcome.didMutate = true
                        outcome.summary = summaryForCreatedEvent(event)
                        outcome.primaryEventId = event.id
                        outcome.primaryIsReminder = event.isReminder == true
                        updateNovaContext(
                            from: userText,
                            title: event.title,
                            date: event.startTime,
                            location: event.location,
                            section: event.section,
                            kind: .event,
                            eventId: event.id
                        )
                    }
                } else {
                    outcome.ignored.append("add_event(invalid)")
                }

            case .addRecurringEvent(let payload, let recurrence):
                let created = expandRecurringEvent(payload: payload, recurrence: recurrence, userText: userText)
                if !created.isEmpty {
                    outcome.didMutate = true
                    outcome.summary = "Agendé \(created.count) instancia\(created.count == 1 ? "" : "s") de «\(payload.title)»."
                    outcome.primaryEventId = created.first?.id
                    updateNovaContext(
                        from: userText,
                        title: payload.title,
                        date: created.first?.startTime,
                        section: created.first?.section,
                        kind: .event,
                        eventId: created.first?.id
                    )
                } else {
                    outcome.ignored.append("add_recurring_event(empty)")
                }

            case .editEvent(let idString, let updates):
                guard let id = parseEventId(idString),
                      var event = events.first(where: { $0.id == id }) else {
                    outcome.ignored.append("edit_event(id_not_found)")
                    continue
                }
                applyUpdates(updates, to: &event)
                updateEvent(event)
                outcome.didMutate = true
                outcome.summary = "Actualicé «\(event.title)»."
                outcome.primaryEventId = event.id
                updateNovaContext(
                    from: userText,
                    title: event.title,
                    date: event.startTime,
                    location: event.location,
                    section: event.section,
                    kind: .event,
                    eventId: event.id
                )

            case .deleteEvent(let idString):
                guard let id = parseEventId(idString),
                      let event = events.first(where: { $0.id == id }) else {
                    outcome.ignored.append("delete_event(id_not_found)")
                    continue
                }
                let title = event.title
                deleteEvent(id)
                outcome.didMutate = true
                outcome.summary = "Eliminé «\(title)»."
                clearNovaContext()

            case .addTask(let payload):
                if let task = makeTask(from: payload) {
                    addTask(task)
                    outcome.didMutate = true
                    outcome.summary = "Tarea «\(task.title)» agregada."
                    outcome.primaryTaskId = task.id
                    updateNovaContext(
                        from: userText,
                        title: task.title,
                        date: task.dueDate,
                        kind: .task,
                        taskId: task.id
                    )
                } else {
                    outcome.ignored.append("add_task(invalid)")
                }

            case .toggleTask(let idString):
                guard let id = parseEventId(idString),
                      tasks.contains(where: { $0.id == id }) else {
                    outcome.ignored.append("toggle_task(id_not_found)")
                    continue
                }
                toggleTask(id)
                outcome.didMutate = true
                outcome.summary = "Tarea actualizada."
                outcome.primaryTaskId = id

            case .deleteTask(let idString):
                guard let id = parseEventId(idString),
                      let task = tasks.first(where: { $0.id == id }) else {
                    outcome.ignored.append("delete_task(id_not_found)")
                    continue
                }
                let title = task.title
                deleteTask(id)
                outcome.didMutate = true
                outcome.summary = "Tarea «\(title)» eliminada."
                clearNovaContext()

            case .remember:
                // V1: memoria no se persiste local todavía. Se ignora
                // silenciosamente (es transparente para el usuario).
                outcome.ignored.append("remember(skipped_v1)")

            case .unsupported(let typeName):
                outcome.ignored.append("unsupported(\(typeName))")
            }
        }

        return outcome
    }

    /// Crea un `FocusEvent` desde el payload del backend. Resuelve fecha/hora,
    /// section, isReminder, inferredDuration. Devuelve nil si no se puede
    /// armar una hora válida.
    private func makeEvent(from payload: BackendEventCreate, userText: String) -> FocusEvent? {
        // PASO 1: Limpiar título via normalizer (centralizado).
        // El backend puede devolver "Acuérdame buscar a Juan" sin limpiar
        // — el normalizer quita reminder triggers, fillers, marcadores
        // temporales sueltos, normaliza nombres propios, y simplifica
        // "Ir a buscar X" → "Buscar a X".
        let rawTitle = payload.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedTitle = NovaActionNormalizer.cleanTitle(rawTitle)
        guard !cleanedTitle.isEmpty else { return nil }

        let cal = Calendar.current
        guard let startTime = NovaTimeFormatter.resolveDate(
            dateString: payload.dateString,
            timeString: payload.timeString
        ) else { return nil }

        // PASO 2: Decidir isReminder via normalizer. Si el `userText`
        // contiene cualquier trigger de recordatorio explícito ("acuérdame",
        // "recuérdame", "avísame", etc.), forzar isReminder=true sin
        // importar lo que dijo el backend. También aceptamos icon=alarm
        // o título original con prefijo "Recordatorio:" como señales.
        let backendIcon = payload.icon ?? ""
        let isReminderHint = NovaActionNormalizer.isReminderTrigger(in: userText)
            || NovaActionNormalizer.impliesPunctualReminder(in: userText)
            || rawTitle.lowercased().hasPrefix("recordatorio")
            || backendIcon.lowercased() == "alarm"

        // PASO 3: Resolver endTime explícito si el backend lo dio.
        var explicitEnd: Date? = nil
        if let endStr = payload.endTimeString,
           !endStr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           let end = NovaTimeFormatter.resolveDate(
                dateString: payload.dateString,
                timeString: endStr
           ),
           end > startTime {
            explicitEnd = end
        }

        // PASO 4: Sección. Si isReminder → .reminder. Si no, primero icon
        // del backend, luego heurística sobre el TÍTULO LIMPIO.
        let section: EventSection
        if isReminderHint {
            section = .reminder
        } else if let iconBased = sectionFromIcon(backendIcon) {
            section = iconBased
        } else {
            section = NovaResponder.guessSection(for: cleanedTitle) ?? .reunion
        }

        // PASO 5: endTime via normalizer. Centralizado para que el visible
        // endTime sea consistente con el local path.
        let endResolution = NovaActionNormalizer.resolveEndTime(
            startTime: startTime,
            providedEndTime: explicitEnd,
            hasExplicitEndTime: explicitEnd != nil,
            isReminder: isReminderHint
        )
        // Para storage interno: si endTime es nil, ponemos start+5min
        // como padding para que el evento ordene bien en el calendario.
        // La UI usa `inferredDuration`/`isReminder` para decidir si
        // mostrar rango o punto.
        let endTime: Date
        let isReminderFlag: Bool?
        let inferredFlag: Bool?
        if let resolved = endResolution.endTime {
            endTime = resolved
            isReminderFlag = nil
            inferredFlag = false
        } else if isReminderHint {
            endTime = cal.date(byAdding: .minute, value: 5, to: startTime) ?? startTime
            isReminderFlag = true
            inferredFlag = nil
        } else {
            endTime = cal.date(byAdding: .minute, value: 5, to: startTime) ?? startTime
            isReminderFlag = nil
            inferredFlag = endResolution.inferredDuration
        }

        // PASO 6: Offsets de aviso. Prioridad:
        //   1. Si el backend devolvió `reminderOffsets`, usamos esos.
        //   2. Si no, intentamos extraer del userText con el normalizer
        //      ("X minutos antes" → [X]).
        //   3. Si tampoco, queda nil → notif al startTime (comportamiento
        //      legacy).
        // Solo aplica cuando isReminder=true; para eventos comunes no
        // programamos notif local todavía.
        let resolvedOffsets: [Int]?
        if let fromBackend = payload.reminderOffsets, !fromBackend.isEmpty {
            resolvedOffsets = fromBackend
        } else if isReminderHint, let extracted = NovaActionNormalizer.extractReminderOffset(from: userText) {
            resolvedOffsets = [extracted]
        } else {
            resolvedOffsets = nil
        }

        return FocusEvent(
            title: cleanedTitle,
            notes: payload.notes,
            startTime: startTime,
            endTime: endTime,
            section: section,
            location: payload.location,
            isReminder: isReminderFlag,
            inferredDuration: inferredFlag,
            reminderOffsets: resolvedOffsets
        )
    }

    /// Crea un `FocusTask` desde el payload del backend.
    private func makeTask(from payload: BackendTaskCreate) -> FocusTask? {
        // Limpiar el label via normalizer — backend puede devolver
        // "tengo que estudiar cálculo" sin strip de "tengo que".
        let rawLabel = payload.label.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedTitle = NovaActionNormalizer.cleanTitle(rawLabel)
        guard !cleanedTitle.isEmpty else { return nil }
        let priority = TaskPriority.fromBackendLabel(payload.priority)
        let category = TaskCategory.fromBackendLabel(payload.category)
        let linkedEventId = payload.linkedEventId.flatMap(parseEventId(_:))
        let parentTaskId = payload.parentTaskId.flatMap(parseEventId(_:))
        return FocusTask(
            title: cleanedTitle,
            priority: priority,
            category: category,
            linkedEventId: linkedEventId,
            parentTaskId: parentTaskId
        )
    }

    /// Aplica updates parciales a un evento. Solo toca los campos
    /// presentes en `BackendEventUpdates`.
    private func applyUpdates(_ updates: BackendEventUpdates, to event: inout FocusEvent) {
        if let newTitle = updates.title?.trimmingCharacters(in: .whitespacesAndNewlines),
           !newTitle.isEmpty {
            event.title = newTitle
        }
        let cal = Calendar.current
        // Si hay date o time nuevos, recomponemos el startTime conservando
        // los que NO vinieron.
        if updates.dateString != nil || updates.timeString != nil {
            let baseDate = updates.dateString.flatMap(NovaTimeFormatter.parseISODate)
                ?? cal.startOfDay(for: event.startTime)
            let (h, m): (Int, Int) = {
                if let parsed = NovaTimeFormatter.parseHourMinute(updates.timeString) {
                    return parsed
                }
                return (cal.component(.hour, from: event.startTime),
                        cal.component(.minute, from: event.startTime))
            }()
            if let newStart = cal.date(bySettingHour: h, minute: m, second: 0, of: baseDate) {
                event.startTime = newStart
                // Si había rango explícito (no inferred), trasladar endTime
                // manteniendo la duración.
                if let oldEnd = event.endTime, event.inferredDuration != true {
                    let delta = oldEnd.timeIntervalSince(event.startTime)
                    event.endTime = newStart.addingTimeInterval(delta)
                } else {
                    // Recordatorio o duración inferida → 5 min después
                    event.endTime = cal.date(byAdding: .minute, value: 5, to: newStart)
                }
            }
        }
        if let newEnd = NovaTimeFormatter.resolveDate(
            dateString: updates.dateString ?? NovaTimeFormatter.formatISODate(from: event.startTime),
            timeString: updates.endTimeString
        ), updates.endTimeString != nil, newEnd > event.startTime {
            event.endTime = newEnd
            event.inferredDuration = false
        }
        if let loc = updates.location?.trimmingCharacters(in: .whitespacesAndNewlines), !loc.isEmpty {
            event.location = loc
        }
        if let newOffsets = updates.reminderOffsets, !newOffsets.isEmpty {
            event.reminderOffsets = newOffsets
        }
    }

    /// Expande un `add_recurring_event` a N `addEvent` locales. Conservador:
    /// máximo 31 instancias por acción (límite del backend).
    private func expandRecurringEvent(
        payload: BackendEventCreate,
        recurrence: BackendRecurrence,
        userText: String
    ) -> [FocusEvent] {
        let cal = Calendar.current
        guard let firstStart = NovaTimeFormatter.resolveDate(
            dateString: recurrence.startDate ?? payload.dateString,
            timeString: payload.timeString
        ) else { return [] }

        let pattern = recurrence.pattern.lowercased()
        let limit: Int
        let stride: Int

        switch pattern {
        case "daily":
            limit = min(recurrence.count ?? 30, 31)
            stride = 1
        case "weekdays":
            limit = min(recurrence.count ?? 22, 31)
            stride = 1  // skip weekends abajo
        case "weekly":
            limit = min(recurrence.count ?? 12, 31)
            stride = 7
        default:
            return []
        }

        var created: [FocusEvent] = []
        var current = firstStart
        var added = 0
        var safety = 0
        while added < limit && safety < 200 {
            safety += 1
            let weekday = cal.component(.weekday, from: current)
            let isWeekend = (weekday == 1 || weekday == 7)
            let shouldCreate: Bool
            switch pattern {
            case "weekdays":
                shouldCreate = !isWeekend
            case "weekly":
                if let target = recurrence.weekday {
                    let targetSwiftWeekday = (target % 7) + 1   // 0=dom backend → 1=dom Swift
                    shouldCreate = weekday == targetSwiftWeekday
                } else {
                    shouldCreate = true
                }
            default:
                shouldCreate = true
            }

            if shouldCreate {
                let single = BackendEventCreate(
                    title: payload.title,
                    timeString: payload.timeString,
                    endTimeString: payload.endTimeString,
                    dateString: NovaTimeFormatter.formatISODate(from: current),
                    section: payload.section,
                    icon: payload.icon,
                    reminderOffsets: payload.reminderOffsets,
                    location: payload.location,
                    notes: payload.notes
                )
                if let event = makeEvent(from: single, userText: userText) {
                    addEvent(event)
                    created.append(event)
                    added += 1
                }
            }

            // Avanzar al siguiente candidato.
            guard let next = cal.date(byAdding: .day, value: stride, to: current) else { break }
            current = next
        }
        return created
    }

    /// Mapeo conservador del `icon` del backend a `EventSection`.
    private func sectionFromIcon(_ icon: String) -> EventSection? {
        switch icon.lowercased() {
        case "fitness_center":          return .descanso
        case "groups":                  return .reunion
        case "menu_book":               return .estudio
        case "work":                    return .foco
        case "alarm":                   return .reminder
        case "local_hospital",
             "shopping_cart", "cake",
             "flight", "account_balance",
             "restaurant":              return .personal
        case "event":                   return .reunion
        default:                        return nil
        }
    }

    /// Construye un mensaje humano para confirmar la creación de un evento
    /// — usado como `summary` inline ("Evento agregado a Calendario.").
    private func summaryForCreatedEvent(_ event: FocusEvent) -> String {
        if event.isReminder == true {
            return "Recordatorio agendado."
        }
        return "Evento agregado a Calendario."
    }

    /// Parsea un `id` string del backend a UUID. Si no es UUID válido,
    /// devolvemos nil (el caller registra en `ignored`).
    private func parseEventId(_ raw: String) -> UUID? {
        UUID(uuidString: raw.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    // MARK: - Nova

    func sendNovaMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        novaMessages.append(NovaMessage(role: .user, content: trimmed))
        persistNovaMessages()
        HapticManager.shared.tap()
        isNovaTyping = true

        // Pre-parse local: si el parser ya resuelve la intención sin
        // ambigüedad (correcciones, follow-ups, comandos meta), short-circuit
        // el backend — backend no tiene `lastEventId` ni el pending local.
        // Si el parser sugiere clarify con título, guardamos pending para
        // que el siguiente turno corto pueda completarlo localmente.
        let preIntent = NovaResponder.parse(trimmed, context: novaContext)
        if shouldShortCircuitLocally(preIntent),
           let localReply = applyLocalNovaIntent(preIntent, userText: trimmed) {
            // Mini-delay para que el typing indicator no parpadee, luego
            // append y terminar — sin tocar backend.
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: 350_000_000)
                await MainActor.run {
                    guard let self else { return }
                    self.novaMessages.append(NovaMessage(role: .nova, content: localReply))
                    self.persistNovaMessages()
                    self.isNovaTyping = false
                }
            }
            return
        }
        if case .clarify(let reason) = preIntent,
           let pending = buildChatPendingClarification(from: reason, userText: trimmed) {
            setPendingClarification(pending)
        }

        // History snapshot ANTES de meter el mensaje del usuario en el
        // history — el server espera turnos anteriores, no el actual.
        let priorHistory: [NovaService.HistoryEntry] = novaMessages
            .dropLast()  // sacar el del usuario que acabamos de pushear
            .suffix(12)
            .map { msg in
                NovaService.HistoryEntry(
                    role: msg.role == .user ? .user : .assistant,
                    content: msg.content
                )
            }

        // Snapshot de eventos/tareas para mandar al backend (mismas
        // ventanas que Mi Día inline).
        let cal = Calendar.current
        let now = Date()
        let horizon = cal.date(byAdding: .day, value: 7, to: now) ?? now
        let visibleEvents = events
            .filter { $0.startTime >= cal.startOfDay(for: now) && $0.startTime <= horizon }
            .sorted { $0.startTime < $1.startTime }
        let visibleTasks = tasks.filter { !$0.done }

        Task { [weak self] in
            guard let self else { return }
            // Mínimo de delay para que el indicador "escribiendo" no parpadee
            // cuando el backend responde muy rápido o el fallback es instantáneo.
            let minDelay: UInt64 = 350_000_000

            let replyText: String
            let actions: [BackendAction]
            let smartActionsBlocked: Bool
            let smartActionsMessage: String?
            let usedFallback: Bool

            if let creds = self.syncCredentialsSnapshot() {
                do {
                    let result = try await NovaService.send(
                        message: trimmed,
                        events: visibleEvents,
                        tasks: visibleTasks,
                        history: priorHistory,
                        accessToken: creds.accessToken,
                        surface: .novaChat
                    )
                    replyText = result.reply
                    actions = result.actions
                    smartActionsBlocked = result.smartActionsBlocked
                    smartActionsMessage = result.smartActionsMessage
                    usedFallback = false
                } catch let err as NovaServiceError where err.canFallbackToLocal {
                    // Fallback local CON ejecución: parsea + aplica intents.
                    // Antes solo generaba texto y no creaba eventos — por eso
                    // un 500 + "acuérdame X mañana" no creaba nada.
                    let (replyJoined, executed) = await MainActor.run {
                        () -> (String, Bool) in
                        let intents = NovaResponder.parseAll(trimmed, context: self.novaContext)
                        var parts: [String] = []
                        var anyExecuted = false
                        for intent in intents {
                            if let r = self.applyLocalNovaIntent(intent, userText: trimmed) {
                                parts.append(r)
                                anyExecuted = true
                            }
                        }
                        if parts.isEmpty {
                            return (NovaResponder.reply(to: trimmed, context: self.novaContext), false)
                        }
                        return (parts.joined(separator: " · "), anyExecuted)
                    }
                    replyText = replyJoined
                    actions = []
                    smartActionsBlocked = false
                    smartActionsMessage = await MainActor.run {
                        self.fallbackNoteForChat(error: err)
                    }
                    usedFallback = true
                    _ = executed
                } catch {
                    let replyJoined = await MainActor.run {
                        () -> String in
                        let intents = NovaResponder.parseAll(trimmed, context: self.novaContext)
                        var parts: [String] = []
                        for intent in intents {
                            if let r = self.applyLocalNovaIntent(intent, userText: trimmed) {
                                parts.append(r)
                            }
                        }
                        return parts.isEmpty
                            ? NovaResponder.reply(to: trimmed, context: self.novaContext)
                            : parts.joined(separator: " · ")
                    }
                    replyText = replyJoined
                    actions = []
                    smartActionsBlocked = false
                    smartActionsMessage = nil
                    usedFallback = true
                }
            } else {
                // Demo / sin sesión → parser local CON ejecución multi-intent.
                let replyJoined = await MainActor.run {
                    () -> String in
                    let intents = NovaResponder.parseAll(trimmed, context: self.novaContext)
                    var parts: [String] = []
                    for intent in intents {
                        if let r = self.applyLocalNovaIntent(intent, userText: trimmed) {
                            parts.append(r)
                        }
                    }
                    return parts.isEmpty
                        ? NovaResponder.reply(to: trimmed, context: self.novaContext)
                        : parts.joined(separator: " · ")
                }
                replyText = replyJoined
                actions = []
                smartActionsBlocked = false
                smartActionsMessage = nil
                usedFallback = false
            }

            try? await Task.sleep(nanoseconds: minDelay)

            await MainActor.run {
                // Aplicar las actions en el main actor (mutaciones del store).
                let outcome = self.applyBackendActions(actions, userText: trimmed)
                // Componer texto final del mensaje de Nova:
                // 1. reply del backend (si vino)
                // 2. resumen de la mutación (si hubo)
                // 3. nota de fallback / cuota (si aplica)
                var pieces: [String] = []
                let cleanReply = replyText.trimmingCharacters(in: .whitespacesAndNewlines)
                if !cleanReply.isEmpty {
                    pieces.append(cleanReply)
                }
                if outcome.didMutate, let s = outcome.summary, !s.isEmpty {
                    // Solo agregar si no es duplicado del reply.
                    if cleanReply.range(of: s) == nil {
                        pieces.append(s)
                    }
                }
                if smartActionsBlocked, let msg = smartActionsMessage {
                    pieces.append(msg)
                }
                if usedFallback, let msg = smartActionsMessage {
                    // En el flujo fallback, smartActionsMessage trae la nota
                    // humana ("Usé el modo local…").
                    if !pieces.contains(where: { $0 == msg }) {
                        pieces.append(msg)
                    }
                }
                let finalText = pieces.isEmpty
                    ? "Listo."
                    : pieces.joined(separator: "\n\n")

                self.novaMessages.append(NovaMessage(role: .nova, content: finalText))
                self.persistNovaMessages()
                self.isNovaTyping = false
            }
        }
    }

    /// Snapshot atómico de las credenciales — leemos en main actor y
    /// devolvemos un valor inmutable para usar dentro del Task sin
    /// data race.
    @MainActor
    private func syncCredentialsSnapshot() -> SyncCredentials? {
        syncCredentials
    }

    /// Convierte un `NovaServiceError` recuperable en una frase humana
    /// para mostrar al final del mensaje de Nova en el chat.
    /// Analiza el día real del usuario y devuelve un resumen humano. Solo
    /// crea una `NovaSuggestion` cuando hay una recomendación CONCRETA
    /// (gaps largos, eventos back-to-back, día vacío sustancial). Si no
    /// hay nada accionable, devuelve solo texto — preserva la credibilidad
    /// de la Bandeja, que no se llena de sugerencias de relleno.
    fileprivate func summarizeAndSuggest(forDayOrganization userText: String) -> String {
        let cal = Calendar.current
        let now = Date()
        let todayStart = cal.startOfDay(for: now)
        let todayEnd = cal.date(byAdding: .day, value: 1, to: todayStart) ?? now

        let todayEvents = events
            .filter { $0.startTime >= todayStart && $0.startTime < todayEnd }
            .sorted { $0.startTime < $1.startTime }

        let pending = tasks.filter { $0.category == .hoy && !$0.done }

        // Caso 1: día completamente vacío.
        if todayEvents.isEmpty && pending.isEmpty {
            return "Tu día está despejado. Cuando tengas algo, dímelo y lo agendamos."
        }

        // Caso 2: solo tareas sin hora.
        if todayEvents.isEmpty && !pending.isEmpty {
            let topThree = pending.prefix(3).map { "• \($0.title)" }.joined(separator: "\n")
            return "No tienes eventos hoy. Tienes \(pending.count) tarea\(pending.count == 1 ? "" : "s") pendiente\(pending.count == 1 ? "" : "s"):\n\(topThree)"
        }

        // Detectar bloques back-to-back: dos eventos con < 15 min de gap.
        var backToBackPairs: [(FocusEvent, FocusEvent, Int)] = []
        for i in 1..<todayEvents.count {
            let prev = todayEvents[i - 1]
            let curr = todayEvents[i]
            guard let prevEnd = prev.endTime else { continue }
            let gapMinutes = Int(curr.startTime.timeIntervalSince(prevEnd) / 60)
            if gapMinutes >= 0, gapMinutes < 15 {
                backToBackPairs.append((prev, curr, gapMinutes))
            }
        }

        // Detectar primer hueco grande (≥ 90 min) tras "ahora" y antes de
        // que termine el día — buen candidato para foco profundo.
        var firstBigGap: (start: Date, minutes: Int)? = nil
        var cursor = max(now, todayStart)
        for event in todayEvents where event.startTime > cursor {
            let gapMinutes = Int(event.startTime.timeIntervalSince(cursor) / 60)
            if gapMinutes >= 90 {
                firstBigGap = (cursor, gapMinutes)
                break
            }
            cursor = max(cursor, event.endTime ?? event.startTime)
        }

        // Construir resumen base.
        let firstEventLabel: String? = todayEvents
            .first(where: { $0.startTime > now })
            .map { ev in
                let hh = DateFormatters.hourMinute.string(from: ev.startTime)
                return "\(ev.title) a las \(hh)"
            }
        var summaryLines: [String] = []
        summaryLines.append("Hoy tienes \(todayEvents.count) evento\(todayEvents.count == 1 ? "" : "s")\(pending.isEmpty ? "" : " y \(pending.count) tarea\(pending.count == 1 ? "" : "s")") .")
        if let next = firstEventLabel {
            summaryLines.append("Próximo: \(next).")
        }

        // Decidir si CREAR una sugerencia concreta:
        if let (a, b, gap) = backToBackPairs.first {
            // Sugerir respiro entre los dos eventos pegados.
            let when = DateFormatters.hourMinute.string(from: a.endTime ?? a.startTime)
            addSuggestion(NovaSuggestion(
                title: "Respiro entre eventos",
                detail: "«\(a.title)» y «\(b.title)» están a \(gap) min de distancia. Podemos mover el segundo 15 min o agregar un buffer corto a las \(when).",
                kind: .break_,
                priority: .high,
                suggestedAction: "Mover «\(b.title)» 15 min"
            ))
            summaryLines.append("Dejé una sugerencia en la Bandeja para que respires entre bloques.")
        } else if let gap = firstBigGap, gap.minutes >= 90 {
            // Avisar del hueco libre sin imponer un "bloque de foco" — el
            // usuario decide qué hacer. Mantenemos la detección pero el
            // copy es neutral.
            let when = DateFormatters.hourMinute.string(from: gap.start)
            let hours = gap.minutes / 60
            let mins = gap.minutes % 60
            let durLabel = hours > 0 ? "\(hours)h\(mins > 0 ? " \(mins)m" : "")" : "\(mins) min"
            addSuggestion(NovaSuggestion(
                title: "Tienes un hueco libre",
                detail: "Quedan \(durLabel) sin nada agendado desde las \(when). Si quieres aprovecharlo, dime qué hacer.",
                kind: .schedule,
                priority: .normal,
                suggestedAction: "Usar el hueco de \(when)"
            ))
            summaryLines.append("Dejé un aviso en la Bandeja sobre ese hueco.")
        }
        // Si no detectamos nada accionable, NO creamos sugerencia — solo
        // damos el resumen. Eso preserva la credibilidad de la Bandeja.

        return summaryLines.joined(separator: " ")
    }

    /// True cuando un intent local debe short-circuit el flujo del backend.
    /// Misma lógica que `MiDiaView.shouldShortCircuit` — duplicada acá para
    /// que el chat la pueda usar sin acoplar State a SwiftUI.
    func shouldShortCircuitLocally(_ intent: NovaIntent) -> Bool {
        switch intent {
        case .correctLastEvent, .deleteLastItem, .convertLastToTask:
            return true
        case .organizeDay, .reviewPending, .askAboutDemo:
            return true
        case .smallTalk:
            return true
        case .createEvent, .createTask:
            return novaContext.pendingIsActive
        default:
            return false
        }
    }

    /// Ejecuta un intent local del parser y devuelve el texto que el chat
    /// debe mostrar. Usado por `sendNovaMessage` cuando short-circuit-ea
    /// el backend (correcciones al último ítem, follow-ups de pending,
    /// comandos meta, confirmaciones cortas).
    ///
    /// Side effects: dispara `addEvent`/`updateEvent`/`deleteEvent`/`addTask`/
    /// `addSuggestion` etc. — todos los métodos que ya sincronizan Supabase.
    /// Devuelve nil si el intent no debería ejecutarse acá (caller fall-through).
    func applyLocalNovaIntent(_ intent: NovaIntent, userText: String) -> String? {
        switch intent {
        case .createEvent(let rawTitle, let when, let explicitEnd, let location, let section, let wantsReminder):
            guard let date = when else { return nil }
            // PASO 1: Limpiar título via normalizer (mismo pipeline que
            // backend path → consistencia 100%).
            let title = NovaActionNormalizer.cleanTitle(rawTitle)
            guard !title.isEmpty else { return nil }

            // PASO 2: isReminder unificado — del intent (wantsReminder)
            // O detectado en userText (trigger explícito "acuérdame" o
            // verbo puntual implícito tipo "despertarme/levantarme").
            let isReminderHint = wantsReminder
                || NovaActionNormalizer.isReminderTrigger(in: userText)
                || NovaActionNormalizer.impliesPunctualReminder(in: userText)

            // PASO 3: endTime via normalizer (centralizado).
            let endResolution = NovaActionNormalizer.resolveEndTime(
                startTime: date,
                providedEndTime: explicitEnd,
                hasExplicitEndTime: explicitEnd != nil && (explicitEnd ?? date) > date,
                isReminder: isReminderHint
            )

            // Internamente padeamos endTime 5min para ordenamiento;
            // flags decide qué muestra la UI.
            let cal = Calendar.current
            let end: Date
            let isReminderFlag: Bool?
            let inferredFlag: Bool?
            if let resolved = endResolution.endTime {
                end = resolved
                isReminderFlag = nil
                inferredFlag = false
            } else if isReminderHint {
                end = cal.date(byAdding: .minute, value: 5, to: date) ?? date
                isReminderFlag = true
                inferredFlag = nil
            } else {
                end = cal.date(byAdding: .minute, value: 5, to: date) ?? date
                isReminderFlag = nil
                inferredFlag = endResolution.inferredDuration
            }
            // Section default neutral (.personal) en vez de .reunion — antes
            // todo lo que no tenía sección detectada caía como "Reunión"
            // visualmente, lo que era engañoso para "seguir trabajando" o
            // "comer". Si no hay nada en el título que detecte sección,
            // .personal es honesto y neutro.
            let effectiveSection: EventSection = isReminderHint
                ? (section ?? .reminder)
                : (section ?? NovaResponder.guessSection(for: title) ?? .personal)

            // PASO 4: anti-duplicado — si ya hay un evento casi igual,
            // no crear nuevo. Evita basura cuando el usuario repite un
            // comando.
            if NovaActionNormalizer.isLikelyDuplicate(
                title: title,
                startTime: date,
                existingEvents: events
            ) {
                return "Ya tenía «\(title)» agendado a esa hora — no lo duplico."
            }

            // PASO 5: Offsets ("X minutos antes") desde userText. Solo
            // tiene sentido si es recordatorio.
            let extractedOffsets: [Int]?
            if isReminderHint, let mins = NovaActionNormalizer.extractReminderOffset(from: userText) {
                extractedOffsets = [mins]
            } else {
                extractedOffsets = nil
            }

            let event = FocusEvent(
                title: title,
                startTime: date,
                endTime: end,
                section: effectiveSection,
                location: location,
                isReminder: isReminderFlag,
                inferredDuration: inferredFlag,
                reminderOffsets: extractedOffsets
            )
            addEvent(event)
            updateNovaContext(
                from: userText,
                title: title,
                date: date,
                location: location,
                section: effectiveSection,
                kind: .event,
                eventId: event.id
            )
            let timeLabel = DateFormatters.hourMinute.string(from: date)
            let dayLabel = DateFormatters.weekdayDay.string(from: date).lowercased()
            return isReminderHint
                ? "Listo, te lo recuerdo: «\(title)» el \(dayLabel) a las \(timeLabel)."
                : "Agendé «\(title)» el \(dayLabel) a las \(timeLabel)."

        case .createTask(let rawTitle, let dueDate, _, let wantsReminder):
            // Mismo pipeline de limpieza para tareas.
            let title = NovaActionNormalizer.cleanTitle(rawTitle)
            guard !title.isEmpty else { return nil }
            let category: TaskCategory = {
                guard let dueDate else { return .hoy }
                let cal = Calendar.current
                if cal.isDateInToday(dueDate) { return .hoy }
                if let diff = cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: dueDate)).day,
                   diff >= 1 && diff <= 7 { return .semana }
                return .algunDia
            }()
            let task = FocusTask(title: title, priority: .media, category: category, dueDate: dueDate)
            addTask(task)
            updateNovaContext(from: userText, title: title, date: dueDate, kind: .task, taskId: task.id)
            let dueBit: String = {
                guard let dueDate else { return "" }
                let cal = Calendar.current
                if cal.isDateInToday(dueDate) { return " para hoy" }
                if cal.isDateInTomorrow(dueDate) { return " para mañana" }
                return " para el " + DateFormatters.weekdayDay.string(from: dueDate).lowercased()
            }()
            let remBit = wantsReminder ? " (con recordatorio)" : ""
            return "Anoto «\(title)»\(dueBit) como tarea.\(remBit)"

        case .correctLastEvent(let modifier):
            guard let eventId = novaContext.lastEventId,
                  var event = events.first(where: { $0.id == eventId }) else {
                return "No tengo nada reciente para mover. Crea un evento nuevo cuando quieras."
            }
            let cal = Calendar.current
            switch modifier {
            case .shiftDays(let offset):
                if let newStart = cal.date(byAdding: .day, value: offset, to: event.startTime) {
                    event.startTime = newStart
                }
                if let oldEnd = event.endTime,
                   let newEnd = cal.date(byAdding: .day, value: offset, to: oldEnd) {
                    event.endTime = newEnd
                }
            case .setTime(let h, let m):
                let day = cal.startOfDay(for: event.startTime)
                if let newStart = cal.date(bySettingHour: h, minute: m, second: 0, of: day) {
                    event.startTime = newStart
                    event.endTime = cal.date(byAdding: .hour, value: 1, to: newStart)
                }
            case .setLocation(let loc):
                event.location = loc
            case .setTitle(let newTitle):
                event.title = newTitle
            }
            updateEvent(event)
            updateNovaContext(
                from: userText,
                title: event.title,
                date: event.startTime,
                location: event.location,
                section: event.section,
                kind: .event,
                eventId: event.id
            )
            let timeLabel = DateFormatters.hourMinute.string(from: event.startTime)
            let dayLabel = DateFormatters.weekdayDay.string(from: event.startTime).lowercased()
            return "Listo, moví «\(event.title)» al \(dayLabel) \(timeLabel)."

        case .convertLastToTask:
            let title = novaContext.lastTitle ?? "Nueva tarea"
            let task = FocusTask(title: title, priority: .media, category: .hoy)
            addTask(task)
            if let eventId = novaContext.lastEventId {
                deleteEvent(eventId)
            }
            updateNovaContext(from: userText, title: title, kind: .task, taskId: task.id)
            return "Lo paso a tareas. «\(title)» quedó en tus pendientes de hoy."

        case .deleteLastItem:
            if let eventId = novaContext.lastEventId,
               let event = events.first(where: { $0.id == eventId }) {
                let title = event.title
                deleteEvent(eventId)
                clearNovaContext()
                return "Eliminado. «\(title)» se borró del calendario."
            }
            if let taskId = novaContext.lastTaskId,
               let task = tasks.first(where: { $0.id == taskId }) {
                let title = task.title
                deleteTask(taskId)
                clearNovaContext()
                return "Eliminada. «\(title)» se borró de pendientes."
            }
            return "No tengo nada reciente para borrar."

        case .organizeDay:
            // Análisis REAL del día — no inventamos sugerencias genéricas.
            // Si no hay datos suficientes para una recomendación verdadera,
            // contestamos con un resumen y NO ensuciamos la Bandeja.
            return summarizeAndSuggest(forDayOrganization: userText)

        case .reviewPending:
            let pending = pendingTodayTasks
            if pending.isEmpty {
                return "No tienes pendientes para hoy. Disfrútalo."
            }
            let preview = pending.prefix(3).map { "• \($0.title)" }.joined(separator: "\n")
            let count = pending.count
            return count == 1
                ? "Tienes 1 pendiente hoy:\n\(preview)"
                : "Tienes \(count) pendientes hoy:\n\(preview)"

        case .askAboutDemo:
            return "Los ejemplos solo aparecen mientras no tengas datos tuyos. Apenas creas tu primer evento o tarea, se reemplazan automáticamente."

        case .smallTalk(let reply):
            return reply

        case .clarify:
            // No short-circuit en clarify — el caller decide si llamar al
            // backend para que pregunte mejor o usar el local responder.
            return nil
        }
    }

    /// Construye un PendingClarification para el chat a partir de un
    /// ClarifyReason del parser local. Espejo de `buildPendingClarification`
    /// de MiDiaView, pero con `source: .novaChat`.
    private func buildChatPendingClarification(
        from reason: NovaIntent.ClarifyReason,
        userText: String
    ) -> PendingClarification? {
        let lower = userText.lowercased()
        let wantsReminder = lower.contains("acu") || lower.contains("recu")
        let section = NovaResponder.guessSection(for: userText)
        switch reason {
        case .eventNeedsTime(let title, let date):
            return PendingClarification(
                originalInput: userText,
                kind: wantsReminder ? .reminder : .event,
                proposedTitle: title,
                proposedDate: date,
                proposedSection: section,
                wantsReminder: wantsReminder,
                missingFields: [.time],
                questionAsked: "¿A qué hora?",
                source: .novaChat
            )
        case .eventNeedsDateTime(let title):
            return PendingClarification(
                originalInput: userText,
                kind: wantsReminder ? .reminder : .event,
                proposedTitle: title,
                proposedDate: nil,
                proposedSection: section,
                wantsReminder: wantsReminder,
                missingFields: [.date, .time],
                questionAsked: "¿Para qué día y hora?",
                source: .novaChat
            )
        case .taskNeedsTitle, .eventNeedsTitle, .noContext, .unclear:
            return nil
        }
    }

    @MainActor
    private func fallbackNoteForChat(error: NovaServiceError) -> String? {
        switch error {
        case .unauthorized:
            return "(Tu sesión expiró. Vuelve a iniciar sesión.)"
        case .quotaExceeded(let m):
            return m.map { "(\($0))" }
        case .offline:
            return "(Sin conexión — guardado local hasta volver a tener internet.)"
        case .timeout, .serviceUnavailable, .badLLMOutput, .network,
             .server, .invalidResponse, .encoding, .decoding:
            // Antes mostrábamos "(Nova avanzada no respondió bien …)" en
            // el chat. Eso preocupaba al usuario aunque la acción se
            // hubiera ejecutado bien por fallback local. Devolver nil
            // suprime la nota — el reply (que ya incluye el resumen de
            // lo que Nova hizo) habla por sí solo.
            return nil
        default:
            return nil
        }
    }

    func runQuickAction(_ action: NovaQuickAction) {
        novaMessages.append(NovaMessage(role: .user, content: action.userText))
        persistNovaMessages()
        HapticManager.shared.tap()
        isNovaTyping = true

        // Para "organizar mi día" usamos análisis REAL del estado del
        // usuario (eventos hoy, tareas pendientes, huecos, back-to-back).
        // El resto de quick actions tienen respuestas predefinidas que
        // siguen teniendo sentido sin contexto.
        let reply: String = {
            switch action {
            case .organizar:
                return summarizeAndSuggest(forDayOrganization: action.userText)
            default:
                return action.novaReply
            }
        }()
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 700_000_000)
            await MainActor.run {
                guard let self else { return }
                self.novaMessages.append(NovaMessage(role: .nova, content: reply))
                self.persistNovaMessages()
                self.isNovaTyping = false
            }
        }
    }

    // MARK: - Ajustes

    func updateSettings(_ mutator: (inout AppSettings) -> Void) {
        let before = settings.remindersEnabled
        var copy = settings
        mutator(&copy)
        settings = copy
        persistSettings()
        HapticManager.shared.tick()

        // Si el toggle "Recordatorios" cambió, re-sync notifs:
        // OFF → cancela todas las pendientes.
        // ON → reprograma futuras (con permiso si toca).
        if before != settings.remindersEnabled {
            if settings.remindersEnabled {
                resyncAllLocalNotifications()
            } else {
                Task {
                    await LocalNotificationService.shared.cancelAllReminders()
                }
            }
        }
    }

    // MARK: - Reset / borrar datos locales

    /// Vuelve al estado inicial con datos de ejemplo (in-memory + disk).
    /// Equivale a "como cuando instalaste la app por primera vez".
    /// **Importante**: NO pre-seedeamos sugerencias en el store. Las demos
    /// vuelven a aparecer como fallback dinámico vía `displaySuggestions`.
    /// También se limpian los descartes de demo — al restablecer, los
    /// ejemplos vuelven a estar visibles.
    func resetToDemoState() {
        FocusLocalStore.clearAll()
        events = []
        tasks = []
        suggestions = []
        novaMessages = []
        settings = .defaults
        novaContext = NovaContext()
        dismissedDemoEventTitles = []
        dismissedDemoTaskTitles = []
        Task { await LocalNotificationService.shared.cancelAllReminders() }
        HapticManager.shared.success()
    }

    /// Borra TODOS los datos locales (in-memory + disk). Más agresivo que reset:
    /// no re-seedea sugerencias ni mensaje de bienvenida.
    /// Pensado para futuro flujo "cerrar sesión / privacidad".
    func clearAllLocalData() {
        FocusLocalStore.clearAll()
        events = []
        tasks = []
        suggestions = []
        novaMessages = []
        settings = .defaults
        novaContext = NovaContext()
        dismissedDemoEventTitles = []
        dismissedDemoTaskTitles = []
        Task { await LocalNotificationService.shared.cancelAllReminders() }
        HapticManager.shared.success()
    }
}
