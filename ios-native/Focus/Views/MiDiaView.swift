import SwiftUI

struct MiDiaView: View {
    private let events: [FocusEvent]
    private let tasks: [FocusTask]

    init(
        events: [FocusEvent]? = nil,
        tasks: [FocusTask]? = nil
    ) {
        self.events = events ?? DemoDataProvider.shared.todayEvents()
        self.tasks = tasks ?? DemoDataProvider.shared.todayTasks()
    }

    private var nextBlock: FocusEvent? {
        let now = Date()
        return events.first { ($0.endTime ?? $0.startTime) >= now }
    }

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
                    header
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.top, Theme.Spacing.lg)

                    focusBarPlaceholder
                        .padding(.horizontal, Theme.Spacing.xl)

                    if let next = nextBlock {
                        ProximoBloqueCard(event: next)
                            .padding(.horizontal, Theme.Spacing.xl)
                    }

                    VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                        HStack {
                            Text("TU DÍA")
                                .sectionLabelStyle()
                            Spacer()
                            Text("\(events.count) bloques")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textTertiary)
                                .tracking(0.4)
                        }
                        .padding(.horizontal, Theme.Spacing.xl)

                        VStack(spacing: 0) {
                            ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                                TimelineEventRow(
                                    event: event,
                                    isLast: index == events.count - 1
                                )
                            }
                        }
                        .padding(.horizontal, Theme.Spacing.xl)
                    }

                    if !tasks.isEmpty {
                        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                            HStack {
                                Text("PARA HOY")
                                    .sectionLabelStyle()
                                Spacer()
                                Text("\(tasks.filter { !$0.done }.count) pendientes")
                                    .font(Theme.Typography.caption)
                                    .foregroundStyle(Theme.Colors.textTertiary)
                                    .tracking(0.4)
                            }
                            .padding(.horizontal, Theme.Spacing.xl)

                            VStack(spacing: Theme.Spacing.sm) {
                                ForEach(tasks) { task in
                                    TaskRowCompact(task: task)
                                }
                            }
                            .padding(.horizontal, Theme.Spacing.xl)
                        }
                    }

                    Spacer(minLength: Theme.Spacing.xxxl)
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Text(todayFormatted)
                    .font(Theme.Typography.subhead)
                    .foregroundStyle(Theme.Colors.textTertiary)
                Text("Mi Día")
                    .font(Theme.Typography.title)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(greeting)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .padding(.top, 2)
            }
            Spacer()
            avatarCircle
        }
    }

    private var avatarCircle: some View {
        Circle()
            .fill(Theme.Colors.surfaceElevated)
            .frame(width: 40, height: 40)
            .overlay(
                Circle()
                    .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
            )
            .overlay(
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 18))
                    .foregroundStyle(Theme.Colors.textTertiary)
            )
    }

    // MARK: - FocusBar placeholder (Fase 5 activa la interacción real)

    private var focusBarPlaceholder: some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: "sparkles")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.Colors.accent.opacity(0.85))
            Text("Habla con Nova…")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textTertiary)
            Spacer()
            HStack(spacing: Theme.Spacing.lg) {
                Image(systemName: "camera")
                Image(systemName: "mic")
            }
            .font(.system(size: 16))
            .foregroundStyle(Theme.Colors.textTertiary)
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.md + 2)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                )
        )
    }

    // MARK: - Formato

    private var todayFormatted: String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "es_ES")
        fmt.dateFormat = "EEEE, d 'de' MMMM"
        let raw = fmt.string(from: Date())
        return raw.prefix(1).uppercased() + raw.dropFirst()
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<6: return "Es de madrugada — descansa si puedes."
        case 6..<12: return "Buenos días. Empecemos."
        case 12..<19: return "Buenas tardes. Sigamos."
        default: return "Buenas noches. Cerremos el día."
        }
    }
}

// MARK: - Próximo Bloque

private struct ProximoBloqueCard: View {
    let event: FocusEvent

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("PRÓXIMO")
                    .font(Theme.Typography.captionEmphasized)
                    .foregroundStyle(Theme.Colors.accent)
                    .tracking(1.2)
                Text(event.title)
                    .font(Theme.Typography.titleEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(2)
                Text(countdownLabel)
                    .font(Theme.Typography.subhead)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .padding(.top, 2)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: Theme.Spacing.xs) {
                Text(event.timeRangeLabel)
                    .font(Theme.Typography.timestamp)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(event.section.displayName)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .tracking(0.6)
            }
        }
        .padding(Theme.Spacing.lg)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                    .fill(Theme.Colors.surfaceElevated)
                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                Theme.Colors.accent.opacity(0.55),
                                Theme.Colors.border
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 0.9
                    )
            }
        )
    }

    private var countdownLabel: String {
        let diff = event.startTime.timeIntervalSinceNow
        if diff <= 0 {
            if let end = event.endTime, end > Date() {
                let mins = Int((end.timeIntervalSinceNow) / 60)
                return mins > 0 ? "En curso · termina en \(mins) min" : "En curso ahora"
            }
            return "Ahora mismo"
        }
        let minutes = Int(diff / 60)
        if minutes < 60 {
            return minutes <= 1 ? "Empieza en 1 min" : "Empieza en \(minutes) min"
        }
        let hours = minutes / 60
        let rem = minutes % 60
        return rem == 0 ? "Empieza en \(hours)h" : "Empieza en \(hours)h \(rem)min"
    }
}

// MARK: - Timeline row

private struct TimelineEventRow: View {
    let event: FocusEvent
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            // Columna hora
            Text(timeLabel)
                .font(Theme.Typography.timestamp)
                .foregroundStyle(Theme.Colors.textSecondary)
                .frame(width: 52, alignment: .trailing)
                .padding(.top, Theme.Spacing.md)

            // Columna dot + línea
            VStack(spacing: 0) {
                Circle()
                    .fill(sectionColor)
                    .frame(width: 9, height: 9)
                    .padding(.top, Theme.Spacing.md + 2)
                if !isLast {
                    Rectangle()
                        .fill(Theme.Colors.border)
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 12)

            // Card del evento
            eventCard
                .padding(.bottom, Theme.Spacing.sm)
        }
    }

    private var eventCard: some View {
        HStack(alignment: .top, spacing: 0) {
            Rectangle()
                .fill(sectionColor)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text(event.title)
                    .font(Theme.Typography.bodyEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)

                if let detail = event.detail, !detail.isEmpty {
                    Text(detail)
                        .font(Theme.Typography.subhead)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .lineLimit(2)
                }

                HStack(spacing: 6) {
                    Text(event.section.displayName.uppercased())
                        .font(Theme.Typography.caption)
                        .foregroundStyle(sectionColor.opacity(0.92))
                        .tracking(0.8)
                    Text("·")
                        .foregroundStyle(Theme.Colors.textQuaternary)
                    Text(event.timeRangeLabel)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                    if event.featured {
                        Text("·")
                            .foregroundStyle(Theme.Colors.textQuaternary)
                        Text("DESTACADO")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.accent)
                            .tracking(0.8)
                    }
                }
                .padding(.top, 2)
            }
            .padding(.vertical, Theme.Spacing.md)
            .padding(.horizontal, Theme.Spacing.md)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                .fill(Theme.Colors.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
    }

    private var timeLabel: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm"
        return fmt.string(from: event.startTime)
    }

    private var sectionColor: Color {
        switch event.section {
        case .foco: return Theme.Colors.sectionFoco
        case .reunion: return Theme.Colors.sectionReunion
        case .personal: return Theme.Colors.sectionPersonal
        case .evening: return Theme.Colors.sectionEvening
        case .reminder: return Theme.Colors.sectionReminder
        }
    }
}

// MARK: - Task row

private struct TaskRowCompact: View {
    let task: FocusTask

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(task.done ? Theme.Colors.success : Theme.Colors.textTertiary)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.label)
                    .font(Theme.Typography.body)
                    .foregroundStyle(task.done ? Theme.Colors.textTertiary : Theme.Colors.textPrimary)
                    .strikethrough(task.done)
                Text(task.priority.label.uppercased())
                    .font(Theme.Typography.caption)
                    .foregroundStyle(priorityColor)
                    .tracking(0.6)
            }
            Spacer()
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                        .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                )
        )
    }

    private var priorityColor: Color {
        switch task.priority {
        case .alta: return Theme.Colors.danger
        case .media: return Theme.Colors.warning
        case .baja: return Theme.Colors.textTertiary
        }
    }
}

#Preview {
    MiDiaView()
        .preferredColorScheme(.dark)
}
