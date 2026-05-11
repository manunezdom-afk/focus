import SwiftUI
import Combine
import Foundation

/// Quick action que el usuario puede tocar en Nova.
enum NovaQuickAction: String, CaseIterable, Identifiable {
    case organizar
    case crearTarea
    case crearEvento
    case revisarPendientes
    case resumenSemana

    var id: String { rawValue }

    var label: String {
        switch self {
        case .organizar: return "Organiza mi día"
        case .crearTarea: return "Crear tarea"
        case .crearEvento: return "Crear evento"
        case .revisarPendientes: return "Revisar pendientes"
        case .resumenSemana: return "Resumen semana"
        }
    }

    var symbol: String {
        switch self {
        case .organizar: return "sparkles"
        case .crearTarea: return "checkmark.circle"
        case .crearEvento: return "calendar.badge.plus"
        case .revisarPendientes: return "tray.full"
        case .resumenSemana: return "chart.bar"
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
        case .resumenSemana:
            return "Esta semana tienes 2 parciales, 1 entrega de TP y 3 reuniones de trabajo. El jueves es el día más cargado. Si quieres, paso una reunión al viernes."
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

/// Store central de la app. Empieza vacío.
/// Cuando los arrays están vacíos, las views muestran ejemplos.
@MainActor
final class FocusDataStore: ObservableObject {
    @Published var events: [FocusEvent] = []
    @Published var tasks: [FocusTask] = []
    @Published var suggestions: [NovaSuggestion]
    @Published var novaMessages: [NovaMessage]
    @Published var settings: AppSettings

    init() {
        // Mi Día y Tareas inician VACÍOS — la UI muestra ejemplos hasta que
        // el usuario cree su primer evento/tarea real.
        self.events = []
        self.tasks = []
        // La Bandeja de Nova siempre tiene sugerencias (Nova está "leyendo" tu día).
        self.suggestions = DemoDataProvider.shared.suggestions()
        self.novaMessages = DemoDataProvider.shared.welcomeNovaMessages()
        self.settings = .defaults
    }

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
        HapticManager.shared.success()
    }

    func deleteEvent(_ id: UUID) {
        events.removeAll { $0.id == id }
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
        HapticManager.shared.tick()
    }

    func addTask(_ task: FocusTask) {
        tasks.insert(task, at: 0)
        HapticManager.shared.success()
    }

    func deleteTask(_ id: UUID) {
        tasks.removeAll { $0.id == id }
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
        if status == .approved {
            HapticManager.shared.success()
        } else {
            HapticManager.shared.tick()
        }
    }

    // MARK: - Nova

    func sendNovaMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        novaMessages.append(NovaMessage(role: .user, content: trimmed))
        HapticManager.shared.tap()

        let reply = NovaResponder.reply(to: trimmed)
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 650_000_000)
            await MainActor.run {
                self?.novaMessages.append(NovaMessage(role: .nova, content: reply))
            }
        }
    }

    func runQuickAction(_ action: NovaQuickAction) {
        novaMessages.append(NovaMessage(role: .user, content: action.userText))
        HapticManager.shared.tap()

        let reply = action.novaReply
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 600_000_000)
            await MainActor.run {
                self?.novaMessages.append(NovaMessage(role: .nova, content: reply))
            }
        }
    }

    // MARK: - Ajustes

    func updateSettings(_ mutator: (inout AppSettings) -> Void) {
        var copy = settings
        mutator(&copy)
        settings = copy
        HapticManager.shared.tick()
    }
}
