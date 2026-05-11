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
            return "Listo. Dejé tu mañana para foco profundo (9:30–11:00), reuniones después del almuerzo y un bloque para Acme a las 15:30. Te aviso cuando empiece cada uno."
        case .crearTarea:
            return "Dime qué tarea quieres crear. Le pongo prioridad y categoría según el contexto."
        case .crearEvento:
            return "Cuéntame qué evento, día y hora. Si quieres, te bloqueo 10 minutos antes para prepararte."
        case .revisarPendientes:
            return "Tienes 3 tareas Alta sin completar: el informe Q1, el mail de Ana y la propuesta de Acme. ¿Las muevo al bloque de foco?"
        case .resumenSemana:
            return "Tu semana: 3 bloques de foco, 4 reuniones, 8 tareas pendientes. El jueves está más cargado. Si quieres puedo bajar una reunión al viernes."
        }
    }
}

/// Responde a texto libre con respuestas mock razonables.
enum NovaResponder {
    static func reply(to text: String) -> String {
        let lower = text.lowercased()

        if lower.contains("organiza") || lower.contains("planifica") || lower.contains("organizar") {
            return "Bloqueo tu mañana para foco y dejo Acme para después del almuerzo. ¿Te muevo algo más?"
        }
        if lower.contains("tarea") {
            return "Lo agrego como tarea con prioridad media. Si quieres otra categoría, dime."
        }
        if lower.contains("evento") || lower.contains("reunión") || lower.contains("reunion") || lower.contains("llamada") {
            return "¿A qué hora y con quién? Lo agendo y te aviso 10 minutos antes."
        }
        if lower.contains("resumen") || lower.contains("semana") {
            return "Esta semana tienes 3 bloques de foco, 4 reuniones y 8 tareas. El jueves es el día más cargado."
        }
        if lower.contains("descans") || lower.contains("pausa") {
            return "Reservo 20 minutos de descanso después de Acme. Tu cerebro lo va a agradecer."
        }
        if lower.contains("hola") || lower.contains("ayuda") {
            return "Soy Nova. Puedo organizar tu día, crear tareas y eventos, y resumirte la semana. ¿Por dónde empezamos?"
        }
        if lower.contains("mañana") {
            return "Mañana tienes 2 reuniones y un bloque de foco libre entre 10:30 y 12:00. ¿Quieres que use ese hueco para algo?"
        }
        if lower.contains("ok") || lower.contains("dale") || lower.contains("listo") {
            return "Perfecto. Lo dejo así. Si cambia algo te aviso."
        }
        return "Lo tomo en cuenta. ¿Quieres que lo convierta en tarea, evento o solo lo guarde como nota?"
    }
}

/// Store central de la app. Todas las views leen y mutan acá.
@MainActor
final class FocusDataStore: ObservableObject {
    @Published var events: [FocusEvent]
    @Published var tasks: [FocusTask]
    @Published var suggestions: [NovaSuggestion]
    @Published var novaMessages: [NovaMessage]
    @Published var settings: AppSettings

    init() {
        self.events = DemoDataProvider.shared.weekEvents()
        self.tasks = DemoDataProvider.shared.allTasks()
        self.suggestions = DemoDataProvider.shared.suggestions()
        self.novaMessages = DemoDataProvider.shared.welcomeNovaMessages()
        self.settings = .defaults
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
        return todayEvents().first { (event) in
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

    func tasks(in category: TaskCategory) -> [FocusTask] {
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
            try? await Task.sleep(nanoseconds: 600_000_000)
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
            try? await Task.sleep(nanoseconds: 550_000_000)
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
