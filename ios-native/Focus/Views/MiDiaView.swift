import SwiftUI

struct MiDiaView: View {
    @EnvironmentObject private var store: FocusDataStore
    @State private var focusBarText: String = ""
    @State private var showNova: Bool = false
    @State private var pendingNovaText: String? = nil

    private var displayEvents: [FocusEvent] {
        if store.hasUserEvents {
            return store.todayEvents()
        }
        return DemoDataProvider.shared.exampleTodayEvents()
    }

    private var showingExamples: Bool {
        !store.hasUserEvents
    }

    private var nextBlock: FocusEvent? {
        let now = Date()
        return displayEvents.first { ($0.endTime ?? $0.startTime) >= now }
    }

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    header
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.top, Theme.Spacing.md)

                    focusBar
                        .padding(.horizontal, Theme.Spacing.xl)

                    if store.pendingSuggestions.count > 0 {
                        NovaPulseCard(count: store.pendingSuggestions.count) {
                            pendingNovaText = nil
                            showNova = true
                        }
                        .padding(.horizontal, Theme.Spacing.xl)
                    }

                    if let next = nextBlock {
                        ProximoBloqueCard(event: next)
                            .padding(.horizontal, Theme.Spacing.xl)
                    }

                    timelineSection

                    if showingExamples {
                        emptyDayPromptsSection
                    } else {
                        pendingTasksSection
                    }

                    Spacer(minLength: Theme.Spacing.bottomBarSafety)
                }
                .padding(.top, Theme.Spacing.sm)
            }
        }
        .sheet(isPresented: $showNova) {
            NovaView(initialPrompt: pendingNovaText)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .onDisappear { pendingNovaText = nil }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text(todayFormatted)
                    .font(Theme.Typography.subhead)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .tracking(0.3)
                Text("Mi Día")
                    .font(Theme.Typography.title)
                    .foregroundStyle(Theme.Colors.textPrimary)
            }
            Spacer()
            HStack(spacing: Theme.Spacing.sm) {
                bandejaButton
                profileButton
            }
        }
    }

    private var bandejaButton: some View {
        Button {
            HapticManager.shared.tap()
            pendingNovaText = nil
            showNova = true
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "tray.full")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .frame(width: 42, height: 42)
                    .background(
                        Circle()
                            .fill(Theme.Colors.surface)
                            .overlay(
                                Circle().strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                            )
                    )
                    .focusCardShadow()
                if store.pendingSuggestions.count > 0 {
                    Circle()
                        .fill(Theme.Colors.novaAccent)
                        .frame(width: 10, height: 10)
                        .overlay(Circle().strokeBorder(Theme.Colors.background, lineWidth: 2))
                        .offset(x: 2, y: -2)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var profileButton: some View {
        Circle()
            .fill(Theme.Colors.surface)
            .frame(width: 42, height: 42)
            .overlay(
                Circle().strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
            )
            .overlay(
                Image(systemName: "person.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textSecondary)
            )
            .focusCardShadow()
    }

    // MARK: - FocusBar (entry point omnipresente a Nova)

    private var focusBar: some View {
        FocusBarInput(
            text: $focusBarText,
            placeholder: "Pregúntale a Nova…",
            onSubmit: {
                let text = focusBarText
                focusBarText = ""
                pendingNovaText = text
                showNova = true
            },
            onTap: {
                // Tap simple sin texto = abre Nova vacío
                if focusBarText.isEmpty {
                    pendingNovaText = nil
                    showNova = true
                }
            },
            onMic: { HapticManager.shared.tap() }
        )
    }

    // MARK: - Timeline

    @ViewBuilder
    private var timelineSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text("TU DÍA")
                    .sectionLabelStyle()
                Spacer()
                if !displayEvents.isEmpty {
                    Text("\(displayEvents.count) bloques")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                        .tracking(0.3)
                }
            }
            .padding(.horizontal, Theme.Spacing.xl)

            if displayEvents.isEmpty {
                EmptyStateView(
                    symbol: "sun.max",
                    title: "Tu día está libre",
                    message: "Agrega un bloque o pídele a Nova que lo organice.",
                    actionLabel: "Hablar con Nova",
                    action: {
                        pendingNovaText = nil
                        showNova = true
                    }
                )
                .frame(minHeight: 260)
                .padding(.horizontal, Theme.Spacing.xl)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(displayEvents.enumerated()), id: \.element.id) { idx, event in
                        TimelineEventRow(
                            event: event,
                            isLast: idx == displayEvents.count - 1
                        )
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)
            }
        }
    }

    // MARK: - Prompts cuando no hay datos del usuario

    private var emptyDayPromptsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            SectionHeader(title: "Pídele a Nova")
                .padding(.horizontal, Theme.Spacing.xl)

            VStack(spacing: Theme.Spacing.sm) {
                ForEach(DemoDataProvider.shared.emptyDayPrompts(), id: \.self) { prompt in
                    PromptChip(text: prompt) {
                        pendingNovaText = prompt
                        showNova = true
                    }
                }
            }
            .padding(.horizontal, Theme.Spacing.xl)
        }
    }

    // MARK: - Pendientes hoy (cuando el usuario tiene datos)

    private var pendingTasksSection: some View {
        let pending = store.pendingTodayTasks
        return VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text("PARA HOY")
                    .sectionLabelStyle()
                Spacer()
                Text(pending.isEmpty ? "Todo listo" : "\(pending.count) pendientes")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .tracking(0.3)
            }
            .padding(.horizontal, Theme.Spacing.xl)

            if pending.isEmpty {
                HStack(spacing: Theme.Spacing.md) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 18))
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
        DateFormatters.capitalizeFirst(DateFormatters.weekdayDayMonth.string(from: Date()))
    }
}

// MARK: - Nova Pulse (banner sutil con sugerencias pendientes)

private struct NovaPulseCard: View {
    let count: Int
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.tap()
            action()
        }) {
            HStack(spacing: Theme.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(Theme.Colors.novaGradient)
                        .frame(width: 36, height: 36)
                    Image(systemName: "sparkle")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(count == 1
                         ? "Nova tiene 1 sugerencia para ti"
                         : "Nova tiene \(count) sugerencias para ti")
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("Revísalas en la Bandeja")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
            .padding(Theme.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(Theme.Colors.novaAccent.opacity(0.25), lineWidth: Theme.Stroke.hairline)
                    )
                    .focusCardShadow()
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Próximo bloque

private struct ProximoBloqueCard: View {
    let event: FocusEvent

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(spacing: Theme.Spacing.sm) {
                Text(event.isNow ? "EN CURSO" : "PRÓXIMO")
                    .font(Theme.Typography.captionEmphasized)
                    .foregroundStyle(event.isNow ? Theme.Colors.success : Theme.Colors.focusAccent)
                    .tracking(1.2)
                Spacer()
                Text(event.timeRangeLabel)
                    .font(Theme.Typography.timestamp)
                    .foregroundStyle(Theme.Colors.textPrimary)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(event.title)
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(2)
                Text(countdownLabel)
                    .font(Theme.Typography.subhead)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }

            HStack(spacing: 6) {
                StatePill(label: event.section.displayName, tint: event.section.color, symbol: event.section.symbol)
                if let loc = event.location, !loc.isEmpty {
                    Image(systemName: "mappin")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Colors.textTertiary)
                    Text(loc)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                }
            }
        }
        .padding(Theme.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .strokeBorder(
                            (event.isNow ? Theme.Colors.success : Theme.Colors.focusAccent).opacity(0.18),
                            lineWidth: 1
                        )
                )
        )
        .focusCardShadow()
    }

    private var countdownLabel: String {
        let now = Date()
        if let end = event.endTime, event.startTime <= now && end >= now {
            let mins = Int(end.timeIntervalSince(now) / 60)
            return mins > 0 ? "Termina en \(mins) min" : "Termina ahora"
        }
        let diff = event.startTime.timeIntervalSinceNow
        if diff <= 0 { return "Empezó ya" }
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
                    .frame(width: 10, height: 10)
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
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                if let notes = event.notes, !notes.isEmpty {
                    Text(notes)
                        .font(Theme.Typography.subhead)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .lineLimit(2)
                }
                HStack(spacing: 6) {
                    StatePill(label: event.section.displayName, tint: event.section.color, symbol: event.section.symbol)
                    if let loc = event.location, !loc.isEmpty {
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
        .focusCardShadow()
    }

    private var timeLabel: String {
        DateFormatters.hourMinute.string(from: event.startTime)
    }
}

// MARK: - Mi Día task row

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
            .focusCardShadow()
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    MiDiaView()
        .environmentObject(FocusDataStore())
}
