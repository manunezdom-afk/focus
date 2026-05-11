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

/// Lo que Nova entendió del mensaje del usuario. La interpretación es local
/// (sin IA real); cuando se conecte el backend, este enum se mantiene y solo
/// cambia el parser.
enum NovaIntent: Hashable {
    /// Crear tarea con un título identificado en el texto del usuario.
    case createTask(title: String)
    /// Crear evento. `when` es opcional — si no lo extrajimos, Nova pide
    /// aclaración antes de crear el evento. `location` es opcional.
    case createEvent(title: String, when: Date?, location: String?)
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
        case eventNeedsDateTime(title: String)
        case unclear
    }
}

/// Responde a texto libre. Tiene 2 caras:
/// - `parse(_:)` → `NovaIntent` estructurado (para Mi Día inline).
/// - `reply(to:)` → string variado para el chat completo.
///
/// Reglas de parsing (heurísticas en español, sin IA):
/// - Verbos de tarea: "crea tarea", "nueva tarea", "agrega tarea", "anota tarea".
/// - Verbos de evento: "agenda", "crea evento", "tengo reunión", "reunión con",
///   "tengo clase", "clase de", etc.
/// - Tiempo: "hoy" / "mañana" / "pasado mañana" / día de la semana.
/// - Hora: "a las HH(:MM)" o "HH:MM" suelto.
/// - Lugar: "en <X>" al final del texto.
enum NovaResponder {

    // MARK: Public API

    static func parse(_ text: String) -> NovaIntent {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()

        // Prioridad 1: preguntas sobre datos demo (la app reemplaza demo al
        // crear el primer item real, no hay un botón "borrar").
        if matches(lower, [
            "borra ejemplo", "borrar ejemplo", "quita ejemplo", "quitar ejemplo",
            "limpia ejemplo", "limpiar ejemplo",
            "borra demo", "quita demo", "limpia demo",
            "borra los ejemplo", "quita los ejemplo"
        ]) {
            return .askAboutDemo
        }

        // Prioridad 2: revisar / resumen.
        if matches(lower, [
            "revisa pendientes", "revisar pendientes",
            "qué tengo pendiente", "que tengo pendiente",
            "qué me falta", "que me falta",
            "qué tengo hoy", "que tengo hoy"
        ]) {
            return .reviewPending
        }

        // Prioridad 3: organizar el día.
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

        // Prioridad 4: crear tarea explícita.
        let taskTriggers = [
            "crea tarea", "crea una tarea",
            "nueva tarea", "agrega tarea",
            "agregar tarea", "anota tarea",
            "anota:", "tarea:"
        ]
        if let title = extractAfter(trimmed, triggers: taskTriggers, allowedTrailingPunct: ":.") {
            if title.isEmpty {
                return .clarify(reason: .taskNeedsTitle)
            }
            return .createTask(title: cleanupTitle(title))
        }

        // Prioridad 5: crear evento (verbos amplios para capturar lenguaje natural).
        let eventTriggers = [
            "agenda", "agéndame", "agendame", "agendar",
            "crea evento", "crea un evento", "nuevo evento", "agrega evento",
            "reunión con", "reunion con", "tengo reunión", "tengo reunion",
            "tengo clase", "tengo evento",
            "agéndalo", "agendalo"
        ]
        if matchesAny(lower, eventTriggers) {
            let title = extractEventTitle(trimmed, triggers: eventTriggers)
            let when = extractDateTime(from: lower)
            let location = extractLocation(from: trimmed)
            if title.isEmpty {
                return .clarify(reason: .eventNeedsTitle)
            }
            // Si entendimos título pero no fecha/hora, pedimos aclaración.
            if when == nil {
                return .clarify(reason: .eventNeedsDateTime(title: title))
            }
            return .createEvent(title: title, when: when, location: location)
        }

        // Prioridad 6: small talk (saludos, agradecimientos).
        if matches(lower, ["hola", "buenas", "buen día", "buen dia", "qué tal", "que tal"]) {
            return .smallTalk(reply: randomGreeting())
        }
        if matches(lower, ["gracias", "perfecto", "dale", "ok", "listo", "genial", "buenísimo", "buenisimo"]) {
            return .smallTalk(reply: randomAcknowledgment())
        }

        // No entiendo → clarify genérico.
        return .clarify(reason: .unclear)
    }

    /// String libre para el chat. Reusa `parse` para entender el mensaje y
    /// elige una respuesta variada en base al intent. Distinto del flujo
    /// inline: acá no ejecutamos acciones, solo respondemos textualmente.
    static func reply(to text: String) -> String {
        let intent = parse(text)
        switch intent {
        case .createTask(let title):
            return Self.pick([
                "Anoto «\(title)» como tarea de hoy con prioridad media.",
                "Listo, agrego «\(title)» a tus pendientes. ¿Le subo la prioridad?",
                "La meto como tarea de hoy. Si querés que sea para esta semana, decime."
            ])
        case .createEvent(let title, let when, let location):
            let timeBit = when.map { "el \(DateFormatters.weekdayDay.string(from: $0).lowercased()) a las \(DateFormatters.hourMinute.string(from: $0))" } ?? "cuando me digas"
            let placeBit = location.map { " en \($0)" } ?? ""
            return Self.pick([
                "Agendo «\(title)»\(placeBit) \(timeBit). ¿Te bloqueo 10 min antes para prepararte?",
                "Listo, evento «\(title)» \(timeBit)\(placeBit). Te aviso 10 min antes.",
                "Va «\(title)» \(timeBit)\(placeBit). Si querés cambiar la hora, decime."
            ])
        case .organizeDay:
            return Self.pick([
                "Te dejo tres sugerencias en la Bandeja: un bloque de foco temprano, una pausa al mediodía y revisar pendientes a la tarde.",
                "Acomodé tu mañana para foco profundo y dejé tareas livianas para después de la siesta. Lo dejé en Bandeja.",
                "Plan del día listo: tres bloques principales, una pausa real y los pendientes priorizados."
            ])
        case .reviewPending:
            return Self.pick([
                "Te paso lo de hoy: revisa Mi Día arriba, los pendientes están en \"Pendientes de hoy\".",
                "Mira «Pendientes de hoy» en Mi Día. Si querés que te los reorganice, decime «organiza mi día».",
                "Tus pendientes de hoy están en la pantalla principal. ¿Querés que los priorice por urgencia?"
            ])
        case .askAboutDemo:
            return "Los ejemplos solo aparecen mientras no tengas datos tuyos. Apenas crees tu primer evento o tarea, se reemplazan automáticamente."
        case .smallTalk(let reply):
            return reply
        case .clarify(.taskNeedsTitle):
            return "Decime qué tarea querés que anote. Ej: «crea tarea estudiar cálculo»."
        case .clarify(.eventNeedsTitle):
            return "¿Qué evento querés que agende? Ej: «agenda reunión con Juan mañana a las 12»."
        case .clarify(.eventNeedsDateTime(let title)):
            return "Tengo «\(title)». ¿Para qué día y a qué hora lo agendo?"
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
    /// sin hora, asume 9:00.
    private static func extractDateTime(from lower: String) -> Date? {
        let cal = Calendar.current
        let now = Date()
        var dayBase: Date? = nil

        if lower.range(of: #"\bpasado ma(ñ|n)ana\b"#, options: .regularExpression) != nil {
            dayBase = cal.date(byAdding: .day, value: 2, to: now)
        } else if lower.range(of: #"\bma(ñ|n)ana\b"#, options: .regularExpression) != nil {
            dayBase = cal.date(byAdding: .day, value: 1, to: now)
        } else if lower.contains("hoy") {
            dayBase = now
        } else if let target = nextWeekday(in: lower, calendar: cal, from: now) {
            dayBase = target
        }

        // Hora explícita
        let hm = extractHourMinute(from: lower)

        if dayBase == nil && hm == nil { return nil }

        var base = dayBase ?? now
        if let (h, m) = hm {
            let start = cal.startOfDay(for: base)
            base = cal.date(bySettingHour: h, minute: m, second: 0, of: start) ?? start
            // Si pusieron solo hora sin día y ya pasó, asumir mañana.
            if dayBase == nil, base <= now {
                base = cal.date(byAdding: .day, value: 1, to: base) ?? base
            }
            return base
        }
        // Día sin hora → 9:00 default
        let start = cal.startOfDay(for: base)
        return cal.date(bySettingHour: 9, minute: 0, second: 0, of: start)
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
        // 1) "a las 14:30" / "a la 1:00"
        if let h = firstCaptureInt(text, pattern: #"a la?s? (\d{1,2}):(\d{2})"#, group: 1),
           let m = firstCaptureInt(text, pattern: #"a la?s? (\d{1,2}):(\d{2})"#, group: 2),
           h < 24, m < 60 {
            return (h, m)
        }
        // 2) "a las 12" / "a la 1"
        if let h = firstCaptureInt(text, pattern: #"a la?s? (\d{1,2})\b"#, group: 1), h < 24 {
            return (h, 0)
        }
        // 3) "14:30" suelto
        if let h = firstCaptureInt(text, pattern: #"\b(\d{1,2}):(\d{2})\b"#, group: 1),
           let m = firstCaptureInt(text, pattern: #"\b(\d{1,2}):(\d{2})\b"#, group: 2),
           h < 24, m < 60 {
            return (h, m)
        }
        return nil
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
