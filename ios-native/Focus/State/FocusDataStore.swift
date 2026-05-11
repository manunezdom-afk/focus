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

/// Responde a texto libre con respuestas mock razonables.
enum NovaResponder {
    static func reply(to text: String) -> String {
        let lower = text.lowercased()

        if lower.contains("organiza") || lower.contains("planifica") || lower.contains("agenda mi") {
            return "Bloqueo tu mañana para foco, dejo una pausa al mediodía y reservo la tarde para estudio. ¿Te muevo algo más?"
        }
        if lower.contains("parcial") || lower.contains("examen") || lower.contains("final") {
            return "Anotado. ¿Para qué día? Te armo bloques de repaso desde ahora hasta esa fecha y te recuerdo al principio de cada sesión."
        }
        if lower.contains("tp") || lower.contains("trabajo práctico") || lower.contains("entrega") {
            return "Lo paso a Hoy con prioridad alta. ¿Quieres que también te bloquee 90 minutos de foco para avanzarlo?"
        }
        if lower.contains("clase") {
            return "Te agendo la clase como bloque recurrente. ¿Qué día y hora? Si tienes el horario de la cursada te lo cargo todo en bloque."
        }
        if lower.contains("estudia") || lower.contains("foco") {
            return "Reservo un bloque de foco. ¿Para qué materia o tema?"
        }
        if lower.contains("tarea") {
            return "Lo agrego como tarea con prioridad media. Si quieres otra categoría, dime."
        }
        if lower.contains("evento") || lower.contains("reunión") || lower.contains("reunion") || lower.contains("llamada") {
            return "¿A qué hora y con quién? Lo agendo y te aviso 10 minutos antes."
        }
        if lower.contains("gym") || lower.contains("entren") || lower.contains("correr") {
            return "Bien. ¿A qué hora suele ser? Lo bloqueo todos los días en ese horario."
        }
        if lower.contains("resumen") || lower.contains("semana") {
            return "Esta semana tienes 2 parciales, 3 reuniones de trabajo y 1 entrega de TP. El jueves es el día más cargado."
        }
        if lower.contains("descans") || lower.contains("pausa") {
            return "Reservo 20 minutos de descanso después del próximo bloque pesado."
        }
        if lower.contains("hola") || lower.contains("ayuda") {
            return "Soy Nova. Puedo organizar tu día, crear tareas y eventos, y recordarte lo importante. ¿Qué tienes pendiente esta semana?"
        }
        if lower.contains("mañana") {
            return "Mañana tienes clase a las 8 y un hueco libre de 10 a 12. ¿Quieres usarlo para foco o para estudio?"
        }
        if lower.contains("ok") || lower.contains("dale") || lower.contains("listo") || lower.contains("perfecto") {
            return "Perfecto. Lo dejo así. Si cambia algo te aviso."
        }
        return "Lo tomo en cuenta. ¿Quieres que lo convierta en tarea, evento o lo guarde como nota?"
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
