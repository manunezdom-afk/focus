import SwiftUI

struct MiDiaView: View {
    @EnvironmentObject private var store: FocusDataStore
    @State private var focusBarText: String = ""
    @State private var navigateToNova = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()
                content
            }
            .navigationDestination(isPresented: $navigateToNova) {
                NovaView()
            }
        }
    }

    private var content: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
                header
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.lg)

                focusBar
                    .padding(.horizontal, Theme.Spacing.xl)

                if store.pendingSuggestions.count > 0 {
                    NovaInboxTeaser(
                        count: store.pendingSuggestions.count,
                        firstSuggestion: store.pendingSuggestions.first
                    ) {
                        navigateToNova = true
                    }
                    .padding(.horizontal, Theme.Spacing.xl)
                }

                if let next = store.nextBlock {
                    ProximoBloqueCard(event: next)
                        .padding(.horizontal, Theme.Spacing.xl)
                }

                timelineSection
                pendingTasksSection

                Spacer(minLength: Theme.Spacing.bottomBarSafety)
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
            .frame(width: 42, height: 42)
            .overlay(
                Circle()
                    .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
            )
            .overlay(
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Theme.Colors.textTertiary)
            )
    }

    // MARK: - FocusBar (envía a Nova al hacer Return)

    private var focusBar: some View {
        FocusBarInput(
            text: $focusBarText,
            placeholder: "Habla con Nova…",
            onSubmit: {
                let text = focusBarText
                focusBarText = ""
                store.sendNovaMessage(text)
                navigateToNova = true
            },
            onMic: { HapticManager.shared.tap() },
            onCamera: { HapticManager.shared.tap() }
        )
    }

    // MARK: - Timeline

    private var timelineSection: some View {
        let events = store.todayEvents()
        return VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            SectionHeader(
                title: "Tu día",
                trailing: events.isEmpty ? nil : "\(events.count) bloques"
            )
            .padding(.horizontal, Theme.Spacing.xl)

            if events.isEmpty {
                EmptyStateView(
                    symbol: "sun.max",
                    title: "Día libre",
                    message: "No hay nada agendado. ¿Quieres pedirle a Nova que organice tu día?",
                    actionLabel: "Hablar con Nova",
                    action: { navigateToNova = true }
                )
                .frame(minHeight: 220)
                .focusCard(radius: Theme.Radius.xl, padding: 0)
                .padding(.horizontal, Theme.Spacing.xl)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(events.enumerated()), id: \.element.id) { idx, event in
                        TimelineEventRow(
                            event: event,
                            isLast: idx == events.count - 1
                        )
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)
            }
        }
    }

    // MARK: - Pendientes hoy

    private var pendingTasksSection: some View {
        let pending = store.pendingTodayTasks
        return VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            SectionHeader(
                title: "Pendientes de hoy",
                trailing: pending.isEmpty ? "Todo listo" : "\(pending.count) pendientes"
            )
            .padding(.horizontal, Theme.Spacing.xl)

            if pending.isEmpty {
                HStack(spacing: Theme.Spacing.md) {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(Theme.Colors.success)
                    Text("Terminaste tus pendientes de hoy.")
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    Spacer()
                }
                .focusCard()
                .padding(.horizontal, Theme.Spacing.xl)
            } else {
                VStack(spacing: Theme.Spacing.sm) {
                    ForEach(pending) { task in
                        MiDiaTaskRow(task: task) {
                            store.toggleTask(task.id)
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)
            }
        }
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

// MARK: - Teaser de Bandeja Nova

private struct NovaInboxTeaser: View {
    let count: Int
    let firstSuggestion: NovaSuggestion?
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.tap()
            action()
        }) {
            HStack(spacing: Theme.Spacing.md) {
                IconBadge(symbol: "sparkles", tint: Theme.Colors.novaAccent, size: 38)

                VStack(alignment: .leading, spacing: 2) {
                    Text(count == 1 ? "Nova tiene 1 sugerencia para ti" : "Nova tiene \(count) sugerencias para ti")
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    if let first = firstSuggestion {
                        Text(first.title)
                            .font(Theme.Typography.subhead)
                            .foregroundStyle(Theme.Colors.textSecondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: Theme.Spacing.sm)

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
            .padding(Theme.Spacing.md + 2)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                    .fill(Theme.Colors.surfaceElevated)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                            .strokeBorder(Theme.Colors.novaAccent.opacity(0.35), lineWidth: Theme.Stroke.hairline)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Próximo bloque

private struct ProximoBloqueCard: View {
    let event: FocusEvent

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text(event.isNow ? "EN CURSO" : "PRÓXIMO")
                    .font(Theme.Typography.captionEmphasized)
                    .foregroundStyle(event.isNow ? Theme.Colors.success : Theme.Colors.novaAccent)
                    .tracking(1.2)
                Text(event.title)
                    .font(Theme.Typography.title2)
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
                StatePill(label: event.section.displayName, tint: event.section.color, symbol: event.section.symbol)
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
                                (event.isNow ? Theme.Colors.success : Theme.Colors.novaAccent).opacity(0.55),
                                Theme.Colors.border
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.0
                    )
            }
        )
    }

    private var countdownLabel: String {
        let now = Date()
        if let end = event.endTime, event.startTime <= now && end >= now {
            let mins = Int(end.timeIntervalSince(now) / 60)
            return mins > 0 ? "Termina en \(mins) min" : "Termina ahora"
        }
        let diff = event.startTime.timeIntervalSinceNow
        if diff <= 0 {
            return "Empezó ya"
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
            Text(timeLabel)
                .font(Theme.Typography.timestamp)
                .foregroundStyle(Theme.Colors.textSecondary)
                .frame(width: 52, alignment: .trailing)
                .padding(.top, Theme.Spacing.md)

            VStack(spacing: 0) {
                Circle()
                    .fill(event.section.color)
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

            card
                .padding(.bottom, Theme.Spacing.sm)
        }
    }

    private var card: some View {
        HStack(alignment: .top, spacing: 0) {
            Rectangle()
                .fill(event.section.color)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text(event.title)
                    .font(Theme.Typography.bodyEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                if let notes = event.notes, !notes.isEmpty {
                    Text(notes)
                        .font(Theme.Typography.subhead)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .lineLimit(2)
                }
                HStack(spacing: 6) {
                    StatePill(label: event.section.displayName, tint: event.section.color, symbol: event.section.symbol)
                    if let loc = event.location, !loc.isEmpty {
                        Text("·")
                            .foregroundStyle(Theme.Colors.textQuaternary)
                        Image(systemName: "mappin")
                            .font(.system(size: 9))
                            .foregroundStyle(Theme.Colors.textTertiary)
                        Text(loc)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                            .lineLimit(1)
                    }
                    if let dur = event.durationLabel {
                        Text("·")
                            .foregroundStyle(Theme.Colors.textQuaternary)
                        Text(dur)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
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
}

// MARK: - Task row para Mi Día

private struct MiDiaTaskRow: View {
    let task: FocusTask
    let onToggle: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.tap()
            onToggle()
        }) {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(task.done ? Theme.Colors.success : Theme.Colors.textTertiary)
                    .animation(.easeInOut(duration: 0.18), value: task.done)

                VStack(alignment: .leading, spacing: 2) {
                    Text(task.title)
                        .font(Theme.Typography.body)
                        .foregroundStyle(task.done ? Theme.Colors.textTertiary : Theme.Colors.textPrimary)
                        .strikethrough(task.done, color: Theme.Colors.textTertiary)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        StatePill(label: task.priority.label, tint: task.priority.color)
                        if task.hasSubtasks {
                            Text("\(task.completedSubtaskCount)/\(task.subtasks.count) subtareas")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textTertiary)
                        }
                    }
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
        .buttonStyle(.plain)
    }
}

#Preview {
    MiDiaView()
        .environmentObject(FocusDataStore())
        .preferredColorScheme(.dark)
}
