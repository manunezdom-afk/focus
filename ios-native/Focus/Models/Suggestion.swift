import SwiftUI
import Foundation

enum SuggestionKind: String, Codable, Hashable, CaseIterable {
    case schedule
    case task
    case rebalance
    case break_
    case prep

    var displayName: String {
        switch self {
        case .schedule: return "Agendar"
        case .task: return "Tarea"
        case .rebalance: return "Reorganizar"
        case .break_: return "Descanso"
        case .prep: return "Preparación"
        }
    }

    var symbol: String {
        switch self {
        case .schedule: return "calendar.badge.plus"
        case .task: return "checkmark.circle"
        case .rebalance: return "arrow.left.arrow.right"
        case .break_: return "cup.and.saucer"
        case .prep: return "doc.text"
        }
    }

    var accent: Color {
        switch self {
        case .schedule: return Theme.Colors.focusAccent
        case .task: return Theme.Colors.success
        case .rebalance: return Theme.Colors.novaAccent
        case .break_: return Theme.Colors.warning
        case .prep: return Theme.Colors.sectionEstudio
        }
    }
}

enum SuggestionStatus: String, Codable, Hashable, CaseIterable {
    case pending
    case approved
    case postponed
    case dismissed

    var displayName: String {
        switch self {
        case .pending: return "Pendiente"
        case .approved: return "Aprobada"
        case .postponed: return "Pospuesta"
        case .dismissed: return "Descartada"
        }
    }
}

enum SuggestionPriority: String, Codable, Hashable {
    case low
    case normal
    case high

    var label: String {
        switch self {
        case .low: return "Baja"
        case .normal: return "Normal"
        case .high: return "Alta"
        }
    }
}

/// Sugerencia que Nova propone al usuario. Vive en la Bandeja de Nova.
struct NovaSuggestion: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var detail: String
    var kind: SuggestionKind
    var priority: SuggestionPriority
    var status: SuggestionStatus
    var suggestedAction: String
    var relatedEventId: UUID?
    var relatedTaskId: UUID?
    var createdAt: Date
    var resolvedAt: Date?

    init(
        id: UUID = UUID(),
        title: String,
        detail: String,
        kind: SuggestionKind,
        priority: SuggestionPriority = .normal,
        status: SuggestionStatus = .pending,
        suggestedAction: String,
        relatedEventId: UUID? = nil,
        relatedTaskId: UUID? = nil,
        createdAt: Date = Date(),
        resolvedAt: Date? = nil
    ) {
        self.id = id
        self.title = title
        self.detail = detail
        self.kind = kind
        self.priority = priority
        self.status = status
        self.suggestedAction = suggestedAction
        self.relatedEventId = relatedEventId
        self.relatedTaskId = relatedTaskId
        self.createdAt = createdAt
        self.resolvedAt = resolvedAt
    }
}
