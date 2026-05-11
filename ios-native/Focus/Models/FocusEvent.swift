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
        case .personal: return "person.fill"
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

/// De dónde viene un evento. `local` = creado en Focus. El resto se reserva
/// para cuando conectemos integraciones reales (Apple EventKit / Google
/// Calendar OAuth / archivo .ics). Por ahora siempre es nil → tratar como local.
enum EventSource: String, Codable, Hashable {
    case local
    case google
    case apple
    case ics
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

    // MARK: - Fields preparados para C5/C6 (integraciones externas)
    // Son **opcionales** a propósito: el `init(from decoder:)` sintetizado por
    // Swift usa `decodeIfPresent` para Optionals, así que el JSON guardado
    // antes de esta versión (sin estos keys) sigue decodificando sin error.
    /// Origen del evento. `nil` → tratar como `.local` (ver `effectiveSource`).
    var source: EventSource?
    /// ID del calendario externo (ej. el calendarId de Google).
    var externalCalendarId: String?
    /// ID del evento en el sistema externo (para detectar duplicados al sync).
    var externalEventId: String?
    /// URL asociada (ej. link de Meet/Zoom). Distinto de `location`.
    var url: String?
    /// Última vez que sincronizamos contra el servicio externo.
    var lastSyncedAt: Date?
    /// Si es `true`, el evento se muestra como punto en el tiempo (solo hora
    /// de inicio, sin rango). El usuario lo creó con "acuérdame"/"recuérdame"
    /// y conceptualmente es un recordatorio, no un bloque con duración.
    var isReminder: Bool?
    /// `true` cuando Nova creó el evento sin que el usuario haya dado hora
    /// fin explícita (no dijo "de X a Y", "hasta Y", "por N horas"). La UI
    /// muestra solo la hora puntual aunque internamente el evento tenga
    /// duración mínima para mantener orden en el timeline.
    var inferredDuration: Bool?

    /// Origen efectivo del evento. Si `source` es nil (data legacy) lo
    /// tratamos como `.local`.
    var effectiveSource: EventSource { source ?? .local }

    /// True si la card debe mostrar solo la hora de inicio (sin "15:00–16:00").
    /// Es punto en el tiempo cuando es recordatorio O cuando la duración fue
    /// inferida (no explícita).
    var displayAsPointInTime: Bool {
        isReminder == true || inferredDuration == true
    }

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
        linkedTaskIds: [UUID] = [],
        source: EventSource? = nil,
        externalCalendarId: String? = nil,
        externalEventId: String? = nil,
        url: String? = nil,
        lastSyncedAt: Date? = nil,
        isReminder: Bool? = nil,
        inferredDuration: Bool? = nil
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
        self.source = source
        self.externalCalendarId = externalCalendarId
        self.externalEventId = externalEventId
        self.url = url
        self.lastSyncedAt = lastSyncedAt
        self.isReminder = isReminder
        self.inferredDuration = inferredDuration
    }

    var timeRangeLabel: String {
        let fmt = DateFormatters.hourMinute
        let start = fmt.string(from: startTime)
        // Recordatorios se muestran como punto en el tiempo (sin rango).
        if displayAsPointInTime { return start }
        if let endTime {
            return "\(start) – \(fmt.string(from: endTime))"
        }
        return start
    }

    var durationLabel: String? {
        // Para recordatorios no mostramos duración (no representa un bloque).
        if displayAsPointInTime { return nil }
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
