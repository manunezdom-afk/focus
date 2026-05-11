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

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .hoy: return "Hoy"
        case .semana: return "Esta semana"
        case .algunDia: return "Algún día"
        }
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
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "es_ES")
            fmt.dateFormat = "d MMM"
            dayPart = fmt.string(from: dueDate)
        }
        guard let dueTime else { return dayPart }
        let tf = DateFormatter()
        tf.dateFormat = "HH:mm"
        return "\(dayPart) · \(tf.string(from: dueTime))"
    }

    var hasSubtasks: Bool { !subtasks.isEmpty }
    var completedSubtaskCount: Int { subtasks.filter { $0.isCompleted }.count }
}
