import Foundation

enum EventSection: String, Codable, CaseIterable, Hashable {
    case foco
    case reunion
    case personal
    case evening
    case reminder

    var displayName: String {
        switch self {
        case .foco: return "Foco"
        case .reunion: return "Reunión"
        case .personal: return "Personal"
        case .evening: return "Tarde"
        case .reminder: return "Recordatorio"
        }
    }
}

struct FocusEvent: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var startTime: Date
    var endTime: Date?
    var detail: String?
    var section: EventSection
    var featured: Bool
    var done: Bool
    var linkedTaskIds: [UUID]

    init(
        id: UUID = UUID(),
        title: String,
        startTime: Date,
        endTime: Date? = nil,
        detail: String? = nil,
        section: EventSection = .reunion,
        featured: Bool = false,
        done: Bool = false,
        linkedTaskIds: [UUID] = []
    ) {
        self.id = id
        self.title = title
        self.startTime = startTime
        self.endTime = endTime
        self.detail = detail
        self.section = section
        self.featured = featured
        self.done = done
        self.linkedTaskIds = linkedTaskIds
    }

    var timeRangeLabel: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm"
        fmt.locale = Locale(identifier: "es_ES")
        let start = fmt.string(from: startTime)
        if let endTime {
            return "\(start) – \(fmt.string(from: endTime))"
        }
        return start
    }
}
