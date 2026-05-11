import Foundation

enum SuggestionKind: String, Codable, Hashable {
    case event
    case task
    case memory
}

enum SuggestionStatus: String, Codable, Hashable {
    case pending
    case approved
    case rejected
}

struct Suggestion: Identifiable, Codable, Hashable {
    let id: UUID
    var kind: SuggestionKind
    var title: String
    var body: String
    var reason: String
    var status: SuggestionStatus
    var createdAt: Date
    var resolvedAt: Date?

    init(
        id: UUID = UUID(),
        kind: SuggestionKind,
        title: String,
        body: String,
        reason: String,
        status: SuggestionStatus = .pending,
        createdAt: Date = Date(),
        resolvedAt: Date? = nil
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.body = body
        self.reason = reason
        self.status = status
        self.createdAt = createdAt
        self.resolvedAt = resolvedAt
    }
}
