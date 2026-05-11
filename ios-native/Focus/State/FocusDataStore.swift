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
            return "Listo. Dejé tu mañana para foco profundo (10:00–11:30), una pausa real al mediodía y la sesión de estudio para Bases de Datos por la tarde. Te aviso cuando empiece cada bloque."
        case .crearTarea:
            return "Dime qué tarea quieres crear. Le pongo prioridad y categoría según el contexto. Ej: \"Entregar TP de Programación el viernes\"."
        case .crearEvento:
            return "Cuéntame qué evento, día y hora. Si quieres, también te bloqueo 10 minutos antes para prepararte."
        case .revisarPendientes:
            return "Tus 3 pendientes de mayor prioridad: repasar fórmulas del parcial, preparar la presentación de Acme y responder al profe. ¿Las acomodo en bloques de hoy o las muevo a mañana?"
        case .prepararManana:
            return "Mañana tienes clase a las 8 y tu jefa te marcó review a las 12. Te dejo un bloque de foco entre 10 y 12, y reservo 15 min antes para prepararte. ¿Te parece?"
        case .cerrarDia:
            return "Hoy completaste 3 tareas y avanzaste 2 bloques de foco. Quedaron 2 sin terminar. ¿Las paso a mañana o las dejo sin horario en pendientes?"
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
    /// Crear tarea con título, opcional recurrencia, opcional flag "acuérdame".
    case createTask(title: String, recurrence: RecurrenceHint?, wantsReminder: Bool)
    /// Crear evento. `when` es opcional — si no lo extrajimos, Nova pide
    /// aclaración. `section` también opcional con default `.reunion`.
    case createEvent(
        title: String,
        when: Date?,
        location: String?,
        section: EventSection?,
        wantsReminder: Bool
    )
    /// Corregir el último evento creado (cambiar día, hora, o ubicación).
    /// Resuelto desde `NovaContext.lastEventId`.
    case correctLastEvent(modifier: EventCorrection)
    /// Convertir el último evento en tarea (mismo título, sin hora).
    case convertLastToTask
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

/// Modificador para `correctLastEvent`. V1: solo soporta cambiar día.
enum EventCorrection: Hashable {
    case shiftDays(offset: Int)            // "no, mañana" → +1; "no, ayer" → -1
    case setTime(hour: Int, minute: Int)   // "cámbialo a las 18"
    case setLocation(String)               // "en sala H013"
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
    var updatedAt: Date = Date()

    enum Kind: Hashable {
        case task
        case event
    }

    var isFresh: Bool {
        // Contexto válido por 10 minutos. Después se trata como "sin contexto".
        Date().timeIntervalSince(updatedAt) < 600
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

    /// Parser principal. `context` permite resolver referencias como
    /// "agéndalo X" o "y X" en base al último intent.
    static func parse(_ text: String, context: NovaContext = NovaContext()) -> NovaIntent {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        let wantsReminder = matches(lower, [
            "acuérdame", "acuerdame", "acordame",
            "recuérdame", "recuerdame", "recordame",
            "no olvides", "que no se me olvide"
        ])

        // ──────────────────────────────────────────────────────────────
        // 0. Correcciones al último intent: "no, mañana", "ponlo como tarea",
        //    "cámbialo a las 18", "en sala H013". Requieren contexto fresco.
        // ──────────────────────────────────────────────────────────────
        if isCorrectionStart(lower), context.isFresh {
            // "ponlo como tarea" / "pásalo a tarea" → convertir.
            if matches(lower, ["como tarea", "ponlo como tarea", "pásalo a tarea", "pasalo a tarea", "convierte en tarea"]) {
                return .convertLastToTask
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
                return .createTask(title: lastTitle, recurrence: recurrence, wantsReminder: wantsReminder)
            }
            // Si menciona "evento" o no menciona tipo → tratar como evento.
            let when = extractDateTime(from: lower) ?? context.lastDate
            let location = extractLocation(from: trimmed) ?? context.lastLocation
            let section = context.lastSection ?? detectSection(in: lower)
            if when == nil {
                return .clarify(reason: .eventNeedsDateTime(title: lastTitle))
            }
            return .createEvent(title: lastTitle, when: when, location: location, section: section, wantsReminder: wantsReminder)
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
                recurrence: recurrence,
                wantsReminder: wantsReminder
            )
        }

        // "tengo que X" / "recordarme X" / "recuérdame X" → tarea
        let taskActionTriggers = [
            "tengo que ", "recordarme ", "recuérdame ", "recuerdame ",
            "no olvides ", "no olvidar "
        ]
        if let title = extractAfter(trimmed, triggers: taskActionTriggers) {
            if title.isEmpty { return .clarify(reason: .taskNeedsTitle) }
            let when = extractDateTime(from: lower)
            let recurrence = detectRecurrence(lower)
            return .createTask(
                title: cleanTaskTitle(title, when: when),
                recurrence: recurrence,
                wantsReminder: wantsReminder
            )
        }

        // ──────────────────────────────────────────────────────────────
        // 6. Evento — verbos amplios para capturar lenguaje natural
        //    incluyendo informal ("salir a", "buscar a", "ir a").
        // ──────────────────────────────────────────────────────────────
        let eventTriggers = [
            "agenda", "agéndame", "agendame", "agendar",
            "agéndalo", "agendalo", "agéndala", "agendala",
            "crea evento", "crea un evento", "nuevo evento", "agrega evento",
            "reunión con", "reunion con",
            "tengo reunión", "tengo reunion",
            "tengo clase", "clase de",
            "tengo prueba", "tengo parcial", "tengo examen", "tengo final",
            "tengo entrega",
            "tengo evento", "tengo cita", "tengo turno",
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
                return .createEvent(title: title, when: partial, location: location, section: section, wantsReminder: wantsReminder)
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
                return .createEvent(title: fullTitle, when: date, location: location, section: .personal, wantsReminder: wantsReminder)
            }
            let recurrence = detectRecurrence(lower)
            return .createTask(title: fullTitle, recurrence: recurrence, wantsReminder: wantsReminder)
        }

        // ──────────────────────────────────────────────────────────────
        // 8. Solo hora/fecha sin verbo, en frases cortas → asumir evento.
        //    Ej: "mañana 12 con Juan" → evento "Con Juan" mañana 12:00.
        // ──────────────────────────────────────────────────────────────
        if let when = extractDateTime(from: lower), hasTimeMarker(lower) {
            let title = cleanupTitle(stripDateTimeMarkers(stripLocationMarker(trimmed)))
            let location = extractLocation(from: trimmed)
            let section = detectSection(in: lower)
            if title.isEmpty {
                return .clarify(reason: .eventNeedsTitle)
            }
            return .createEvent(title: title, when: when, location: location, section: section, wantsReminder: wantsReminder)
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
        case .createTask(let title, let recurrence, let wantsReminder):
            let recBit = recurrence.map { " (\($0.label) — la recurrencia queda preparada para más adelante)" } ?? ""
            let remBit = wantsReminder ? " Las notificaciones automáticas todavía están en preparación." : ""
            return Self.pick([
                "Anoto «\(title)» como tarea de hoy\(recBit).\(remBit)",
                "Listo, agrego «\(title)» a tus pendientes\(recBit).\(remBit)",
                "La meto como tarea de hoy\(recBit). Si querés cambiar la prioridad, decime.\(remBit)"
            ])
        case .createEvent(let title, let when, let location, let section, let wantsReminder):
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
            }
        case .convertLastToTask:
            return "Lo paso a tareas."
        case .organizeDay:
            return Self.pick([
                "Te dejo tres sugerencias en la Bandeja: un bloque de foco temprano, una pausa al mediodía y revisar pendientes a la tarde.",
                "Acomodé tu mañana para foco profundo y dejé tareas livianas para después de la siesta. Está en Bandeja.",
                "Plan del día listo: tres bloques principales, una pausa real y los pendientes priorizados."
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

    private static func firstMatchingTrigger(in text: String, triggers: [String]) -> String? {
        let lower = text.lowercased()
        var best: (String, String.Index)?
        for trigger in triggers {
            if let range = lower.range(of: trigger),
               best == nil || range.lowerBound < best!.1 {
                best = (trigger, range.lowerBound)
            }
        }
        return best?.0
    }

    /// True si el texto arranca como corrección del último intent
    /// ("no, mañana", "mejor X", "ponlo X", "cámbialo X").
    private static func isCorrectionStart(_ lower: String) -> Bool {
        lower == "no" ||
        lower.hasPrefix("no,") || lower.hasPrefix("no ") ||
        lower.hasPrefix("mejor ") ||
        lower.hasPrefix("cámbialo") || lower.hasPrefix("cambialo") ||
        lower.hasPrefix("cámbiale") || lower.hasPrefix("cambiale") ||
        lower.hasPrefix("ponlo ") || lower.hasPrefix("ponla ") ||
        lower.hasPrefix("pásalo ") || lower.hasPrefix("pasalo ") ||
        lower.hasPrefix("muévelo") || lower.hasPrefix("muevelo")
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

    private static func detectSection(in lower: String) -> EventSection? {
        if matches(lower, [
            "parcial", "examen", "final", "prueba",
            "clase", "estudiar", "estudio", "tp ", "tarea de ",
            "entrega", "presentación", "presentacion", "tesis"
        ]) {
            return .estudio
        }
        if matches(lower, [
            "reunión", "reunion", "review", "1:1", "1on1",
            "meet", "llamada", "call", "stand up", "standup", "stand-up",
            "demo"
        ]) {
            return .reunion
        }
        if matches(lower, [
            "amigo", "amiga", "amigas", "amigos",
            "familia", "mamá", "papá", "mama", "papa",
            "salir ", "buscar a ", "buscar al ", "buscar la ", "buscar el ",
            "juntarme", "juntarnos", "junta con", "me junto",
            "almuerzo", "cena", "desayuno", "café con", "cafe con",
            "novia", "novio", "pareja"
        ]) {
            return .personal
        }
        if matches(lower, ["foco profundo", "deep work", "concentrar", "concentrarme"]) {
            return .foco
        }
        if matches(lower, ["gym", "correr", "yoga", "pilates", "running", "siesta", "pausa", "descanso"]) {
            return .descanso
        }
        return nil
    }

    // MARK: - Time markers

    /// True si el texto incluye marcador explícito de hora (no solo día).
    private static func hasTimeMarker(_ lower: String) -> Bool {
        if firstCaptureInt(lower, pattern: #"a la?s? (\d{1,2})"#, group: 1) != nil { return true }
        if firstCaptureInt(lower, pattern: #"\b(\d{1,2}):(\d{2})\b"#, group: 1) != nil { return true }
        if firstCaptureInt(lower, pattern: #"\btipo\s+(?:las?\s+)?(\d{1,2})"#, group: 1) != nil { return true }
        if firstCaptureInt(lower, pattern: #"\b(\d{1,2})\s*(am|pm|hs|hrs)\b"#, group: 1) != nil { return true }
        if matches(lower, ["esta tarde", "esta noche", "esta mañana", "esta manana", "al mediodía", "al mediodia", "al atardecer"]) {
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
        // Quitar marcadores temporales (mañana / hoy / a las 5) y de lugar.
        title = stripDateTimeMarkers(title)
        title = stripLocationMarker(title)
        // Quitar muletillas pegadas al inicio.
        let stopPrefixes = [
            "que ", "de ", "el ", "la ", "los ", "las ",
            "para ", "a "
        ]
        // Solo dropea muletillas si la frase aún tiene contenido.
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

    private static func extractEventTitle(_ text: String, triggers: [String]) -> String {
        guard var raw = extractAfter(text, triggers: triggers, allowedTrailingPunct: ":.") else {
            return ""
        }
        // Limpiar marcadores temporales y de lugar para que el título sea solo
        // el "qué" del evento.
        raw = stripDateTimeMarkers(raw)
        raw = stripLocationMarker(raw)
        raw = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".,;"))
        return cleanupTitle(raw)
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

    private static let dateTimeMarkerPatterns: [String] = [
        #"\bhoy\b"#,
        #"\bmañana\b"#,
        #"\bmanana\b"#,
        #"\bpasado mañana\b"#,
        #"\bpasado manana\b"#,
        #"\bel (lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b"#,
        #"\ba las? \d{1,2}(:\d{2})?(am|pm|hrs)?\b"#,
        #"\b\d{1,2}:\d{2}\b"#
    ]

    private static func stripDateTimeMarkers(_ text: String) -> String {
        var out = text
        for pattern in dateTimeMarkerPatterns {
            out = out.replacingOccurrences(
                of: pattern,
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
        }
        return out
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
            || lower.contains("al mediodía") || lower.contains("al mediodia") {
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
        // 1) "a las 14:30" / "a la 1:00" (también "a eso de las 14:30")
        if let h = firstCaptureInt(text, pattern: #"(?:a la?s?|eso de las?|cerca de las?|alrededor de las?) (\d{1,2}):(\d{2})"#, group: 1),
           let m = firstCaptureInt(text, pattern: #"(?:a la?s?|eso de las?|cerca de las?|alrededor de las?) (\d{1,2}):(\d{2})"#, group: 2),
           h < 24, m < 60 {
            return (h, m)
        }
        // 2) "a las 12" / "a la 1" / "a eso de las 3" / "cerca de las 3"
        if let h = firstCaptureInt(text, pattern: #"(?:a la?s?|eso de las?|cerca de las?|alrededor de las?) (\d{1,2})\b"#, group: 1), h < 24 {
            return (adjustAmPm(hour: h, in: text), 0)
        }
        // 3) "14:30" suelto
        if let h = firstCaptureInt(text, pattern: #"\b(\d{1,2}):(\d{2})\b"#, group: 1),
           let m = firstCaptureInt(text, pattern: #"\b(\d{1,2}):(\d{2})\b"#, group: 2),
           h < 24, m < 60 {
            return (h, m)
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
        // 6) "esta tarde" / "esta noche" / "al mediodía"
        if text.contains("esta noche") { return (20, 0) }
        if text.contains("esta tarde") { return (16, 0) }
        if text.contains("al mediodía") || text.contains("al mediodia") { return (12, 0) }
        if text.contains("esta mañana") || text.contains("esta manana") { return (9, 0) }
        return nil
    }

    /// "tipo 3" → 15. "tipo 8 de la mañana" → 8. "tipo 12" → 12.
    private static func resolveTipoHour(_ n: Int, in text: String) -> Int {
        let isMorning = text.contains("de la mañana") || text.contains("de la manana") || text.contains(" am")
        let isAfternoon = text.contains("de la tarde") || text.contains("de la noche") || text.contains(" pm")
        if isMorning { return n }
        if isAfternoon, n < 12 { return n + 12 }
        if n == 0 { return 12 }
        if n == 12 { return 12 }
        if n >= 13 { return n }  // ya en formato 24h
        // 1..11 sin modificador → asumir PM (uso social común).
        return n + 12
    }

    /// Ajusta hora N=1..12 cuando no hay marcador AM/PM. Regla coloquial
    /// para español chileno/latino: "a las 3" para una actividad normal de día
    /// se interpreta como **15:00**, no 03:00.
    ///
    /// - Marcador explícito "am"/"de la mañana"/"madrugada" → AM (mantener hora).
    /// - Marcador explícito "pm"/"de la tarde"/"de la noche" → PM (+12).
    /// - Sin marcador:
    ///   - 1..7 → PM (uso social/diurno típico: 3 = 15:00, 7 = 19:00).
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

        // 3) Sin marcador → regla coloquial chilena/latina.
        if hour >= 1 && hour <= 7 { return hour + 12 }   // 1→13, 3→15, 7→19
        return hour                                        // 8..12 quedan AM
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
        return withoutPrefix.isEmpty ? nil : cleanupTitle(withoutPrefix)
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

    init() {
        self.events = FocusLocalStore.load([FocusEvent].self, forKey: .events) ?? []
        self.tasks = FocusLocalStore.load([FocusTask].self, forKey: .tasks) ?? []
        self.suggestions = FocusLocalStore.load([NovaSuggestion].self, forKey: .suggestions)
            ?? DemoDataProvider.shared.suggestions()
        self.novaMessages = FocusLocalStore.load([NovaMessage].self, forKey: .novaMessages)
            ?? DemoDataProvider.shared.welcomeNovaMessages()
        self.settings = FocusLocalStore.load(AppSettings.self, forKey: .settings)
            ?? .defaults
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
            updatedAt: Date()
        )
    }

    func clearNovaContext() {
        novaContext = NovaContext()
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

    var nextBlock: FocusEvent? {
        let now = Date()
        return todayEvents().first { event in
            (event.endTime ?? event.startTime) >= now
        }
    }

    func addEvent(_ event: FocusEvent) {
        events.append(event)
        events.sort { $0.startTime < $1.startTime }
        persistEvents()
        HapticManager.shared.success()
    }

    func deleteEvent(_ id: UUID) {
        events.removeAll { $0.id == id }
        persistEvents()
    }

    /// Actualiza un evento existente. No falla silenciosamente si el id no
    /// existe — solo no hace nada.
    func updateEvent(_ event: FocusEvent) {
        guard let idx = events.firstIndex(where: { $0.id == event.id }) else { return }
        events[idx] = event
        events.sort { $0.startTime < $1.startTime }
        persistEvents()
        HapticManager.shared.tick()
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
        HapticManager.shared.tick()
    }

    func addTask(_ task: FocusTask) {
        tasks.insert(task, at: 0)
        persistTasks()
        HapticManager.shared.success()
    }

    func deleteTask(_ id: UUID) {
        tasks.removeAll { $0.id == id }
        persistTasks()
        HapticManager.shared.tick()
    }

    // MARK: - Sugerencias

    var pendingSuggestions: [NovaSuggestion] {
        suggestions.filter { $0.status == .pending }
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

    // MARK: - Nova

    func sendNovaMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        novaMessages.append(NovaMessage(role: .user, content: trimmed))
        persistNovaMessages()
        HapticManager.shared.tap()

        let reply = NovaResponder.reply(to: trimmed)
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 650_000_000)
            await MainActor.run {
                guard let self else { return }
                self.novaMessages.append(NovaMessage(role: .nova, content: reply))
                self.persistNovaMessages()
            }
        }
    }

    func runQuickAction(_ action: NovaQuickAction) {
        novaMessages.append(NovaMessage(role: .user, content: action.userText))
        persistNovaMessages()
        HapticManager.shared.tap()

        let reply = action.novaReply
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 600_000_000)
            await MainActor.run {
                guard let self else { return }
                self.novaMessages.append(NovaMessage(role: .nova, content: reply))
                self.persistNovaMessages()
            }
        }
    }

    // MARK: - Ajustes

    func updateSettings(_ mutator: (inout AppSettings) -> Void) {
        var copy = settings
        mutator(&copy)
        settings = copy
        persistSettings()
        HapticManager.shared.tick()
    }

    // MARK: - Reset / borrar datos locales

    /// Vuelve al estado inicial con datos de ejemplo (in-memory + disk).
    /// Equivale a "como cuando instalaste la app por primera vez".
    func resetToDemoState() {
        FocusLocalStore.clearAll()
        events = []
        tasks = []
        suggestions = DemoDataProvider.shared.suggestions()
        novaMessages = DemoDataProvider.shared.welcomeNovaMessages()
        settings = .defaults
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
        HapticManager.shared.success()
    }
}
