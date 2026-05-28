import SwiftUI
import Foundation

enum TaskPriority: String, Codable, CaseIterable, Hashable, Identifiable {
    case alta
    case media
    case baja

    var id: String { rawValue }

    var label: String {
        switch self {
        case .alta: return "Alta"
        case .media: return "Media"
        case .baja: return "Baja"
        }
    }

    var color: Color {
        switch self {
        case .alta: return Theme.Colors.priorityHigh
        case .media: return Theme.Colors.priorityMedium
        case .baja: return Theme.Colors.priorityLow
        }
    }

    var symbol: String {
        switch self {
        case .alta: return "exclamationmark.circle.fill"
        case .media: return "circle.fill"
        case .baja: return "circle"
        }
    }
}

enum TaskCategory: String, Codable, CaseIterable, Hashable, Identifiable {
    case hoy
    case semana
    case algunDia = "algun_dia"
    /// Captura rápida de Nova SIN hora ("decirle a la psiquiatra lo de la
    /// receta"). No es un evento (no tiene hora) ni una tarea de la lista de
    /// Tareas: se muestra como recordatorio dentro de Mi Día, en un formato
    /// distinto al de los bloques con hora. Persistido como string → sobrevive
    /// el round-trip de sync sin migración de schema (el backend guarda y
    /// devuelve el rawValue tal cual).
    case recordatorio

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .hoy: return "Hoy"
        case .semana: return "Esta semana"
        case .algunDia: return "Algún día"
        case .recordatorio: return "Recordatorio"
        }
    }

    /// `true` para las categorías que la pestaña Tareas debe MOSTRAR. Los
    /// recordatorios viven solo en Mi Día, así que quedan fuera.
    var isTaskListCategory: Bool { self != .recordatorio }

    /// Categorías reales de la lista de Tareas, en orden. Excluye
    /// `.recordatorio`. Usar en vez de `allCases` en la pestaña Tareas.
    static var taskListCases: [TaskCategory] {
        allCases.filter { $0.isTaskListCategory }
    }

    /// Categoría para una tarea creada por Nova según su fecha límite. Sin
    /// fecha → `.recordatorio` (se muestra en Mi Día, fuera de Tareas). Con
    /// fecha, su bucket temporal normal. Centraliza la regla "sin hora =
    /// recordatorio" que el usuario pidió.
    static func forNovaDueDate(_ date: Date?) -> TaskCategory {
        guard let date else { return .recordatorio }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return .hoy }
        if let diff = cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: date)).day,
           diff >= 1 && diff <= 7 { return .semana }
        return .algunDia
    }
}

struct FocusSubtask: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var isCompleted: Bool

    init(id: UUID = UUID(), title: String, isCompleted: Bool = false) {
        self.id = id
        self.title = title
        self.isCompleted = isCompleted
    }
}

struct FocusTask: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var notes: String?
    var done: Bool
    var doneAt: Date?
    var priority: TaskPriority
    var category: TaskCategory
    var dueDate: Date?
    var dueTime: Date?
    var subtasks: [FocusSubtask]
    var linkedEventId: UUID?
    var parentTaskId: UUID?

    init(
        id: UUID = UUID(),
        title: String,
        notes: String? = nil,
        done: Bool = false,
        doneAt: Date? = nil,
        priority: TaskPriority = .media,
        category: TaskCategory = .hoy,
        dueDate: Date? = nil,
        dueTime: Date? = nil,
        subtasks: [FocusSubtask] = [],
        linkedEventId: UUID? = nil,
        parentTaskId: UUID? = nil
    ) {
        self.id = id
        self.title = title
        self.notes = notes
        self.done = done
        self.doneAt = doneAt
        self.priority = priority
        self.category = category
        self.dueDate = dueDate
        self.dueTime = dueTime
        self.subtasks = subtasks
        self.linkedEventId = linkedEventId
        self.parentTaskId = parentTaskId
    }

    /// "Hoy", "Mañana 09:00", o nil si no tiene fecha.
    var dueLabel: String? {
        guard let dueDate else { return nil }
        let cal = Calendar.current
        let isToday = cal.isDateInToday(dueDate)
        let isTomorrow = cal.isDateInTomorrow(dueDate)
        let dayPart: String
        if isToday {
            dayPart = "Hoy"
        } else if isTomorrow {
            dayPart = "Mañana"
        } else {
            dayPart = DateFormatters.shortDayMonth.string(from: dueDate)
        }
        guard let dueTime else { return dayPart }
        return "\(dayPart) · \(DateFormatters.hourMinute.string(from: dueTime))"
    }

    var hasSubtasks: Bool { !subtasks.isEmpty }
    var completedSubtaskCount: Int { subtasks.filter { $0.isCompleted }.count }

    /// `true` cuando esta tarea es en realidad un recordatorio sin hora — se
    /// muestra en Mi Día y NO en la pestaña Tareas.
    var isReminder: Bool { category == .recordatorio }
}
