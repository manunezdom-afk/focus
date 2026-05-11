import SwiftUI
import Foundation

enum EventSection: String, Codable, CaseIterable, Hashable, Identifiable {
    case foco
    case reunion
    case personal
    case estudio
    case descanso
    case reminder

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .foco: return "Foco"
        case .reunion: return "Reunión"
        case .personal: return "Personal"
        case .estudio: return "Estudio"
        case .descanso: return "Descanso"
        case .reminder: return "Recordatorio"
        }
    }

    var color: Color {
        switch self {
        case .foco: return Theme.Colors.sectionFoco
        case .reunion: return Theme.Colors.sectionReunion
        case .personal: return Theme.Colors.sectionPersonal
        case .estudio: return Theme.Colors.sectionEstudio
        case .descanso: return Theme.Colors.sectionDescanso
        case .reminder: return Theme.Colors.sectionReminder
        }
    }

    var symbol: String {
        switch self {
        case .foco: return "scope"
        case .reunion: return "person.2.fill"
        case .personal: return "heart.fill"
        case .estudio: return "book.fill"
        case .descanso: return "cup.and.saucer.fill"
        case .reminder: return "bell.fill"
        }
    }
}

enum EventStatus: String, Codable, Hashable {
    case scheduled
    case inProgress
    case done
    case cancelled
}

struct FocusEvent: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var notes: String?
    var startTime: Date
    var endTime: Date?
    var section: EventSection
    var status: EventStatus
    var location: String?
    var featured: Bool
    var linkedTaskIds: [UUID]

    init(
        id: UUID = UUID(),
        title: String,
        notes: String? = nil,
        startTime: Date,
        endTime: Date? = nil,
        section: EventSection = .reunion,
        status: EventStatus = .scheduled,
        location: String? = nil,
        featured: Bool = false,
        linkedTaskIds: [UUID] = []
    ) {
        self.id = id
        self.title = title
        self.notes = notes
        self.startTime = startTime
        self.endTime = endTime
        self.section = section
        self.status = status
        self.location = location
        self.featured = featured
        self.linkedTaskIds = linkedTaskIds
    }

    var timeRangeLabel: String {
        let fmt = DateFormatters.hourMinute
        let start = fmt.string(from: startTime)
        if let endTime {
            return "\(start) – \(fmt.string(from: endTime))"
        }
        return start
    }

    var durationLabel: String? {
        guard let end = endTime else { return nil }
        let mins = Int(end.timeIntervalSince(startTime) / 60)
        if mins < 60 {
            return "\(mins) min"
        }
        let h = mins / 60
        let m = mins % 60
        return m == 0 ? "\(h)h" : "\(h)h \(m)m"
    }

    var isNow: Bool {
        let now = Date()
        guard let end = endTime else { return false }
        return startTime <= now && end >= now
    }
}
