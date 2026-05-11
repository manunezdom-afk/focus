import Foundation

enum TaskPriority: String, Codable, CaseIterable, Hashable {
    case alta
    case media
    case baja

    var label: String {
        switch self {
        case .alta: return "Alta"
        case .media: return "Media"
        case .baja: return "Baja"
        }
    }
}

enum TaskCategory: String, Codable, CaseIterable, Hashable {
    case hoy
    case semana
    case algunDia = "algun_dia"

    var displayName: String {
        switch self {
        case .hoy: return "Hoy"
        case .semana: return "Esta semana"
        case .algunDia: return "Algún día"
        }
    }
}

struct FocusTask: Identifiable, Codable, Hashable {
    let id: UUID
    var label: String
    var done: Bool
    var doneAt: Date?
    var priority: TaskPriority
    var category: TaskCategory
    var dueDate: Date?
    var linkedEventId: UUID?
    var parentTaskId: UUID?

    init(
        id: UUID = UUID(),
        label: String,
        done: Bool = false,
        doneAt: Date? = nil,
        priority: TaskPriority = .media,
        category: TaskCategory = .hoy,
        dueDate: Date? = nil,
        linkedEventId: UUID? = nil,
        parentTaskId: UUID? = nil
    ) {
        self.id = id
        self.label = label
        self.done = done
        self.doneAt = doneAt
        self.priority = priority
        self.category = category
        self.dueDate = dueDate
        self.linkedEventId = linkedEventId
        self.parentTaskId = parentTaskId
    }
}
