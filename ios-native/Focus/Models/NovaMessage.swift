import Foundation

enum NovaRole: String, Codable, Hashable {
    case user
    case nova
}

struct NovaMessage: Identifiable, Codable, Hashable {
    let id: UUID
    var role: NovaRole
    var content: String
    var timestamp: Date
    var actionLabels: [String]

    init(
        id: UUID = UUID(),
        role: NovaRole,
        content: String,
        timestamp: Date = Date(),
        actionLabels: [String] = []
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.actionLabels = actionLabels
    }
}
