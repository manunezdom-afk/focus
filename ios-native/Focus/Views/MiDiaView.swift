import SwiftUI

struct MiDiaView: View {
    @EnvironmentObject private var store: FocusDataStore
    @State private var focusBarText: String = ""
    @State private var showNova: Bool = false
    @State private var pendingNovaText: String? = nil
    @State private var showAllEvents: Bool = false

    private let visibleEventsLimit: Int = 3

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

            // Hero zone: gradiente azul muy sutil detrás del header + FocusBar.
            // Diferencia visualmente Mi Día de las otras tabs.
            VStack(spacing: 0) {
                LinearGradient(
                    colors: [
                        Theme.Colors.focusAccent.opacity(0.08),
                        Theme.Colors.background
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 280)
                Spacer()
            }
            .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    header
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.top, Theme.Spacing.md)

                    focusBar
                        .padding(.horizontal, Theme.Spacing.xl)

                    // El banner "Nova tiene N sugerencias" se removió de Mi Día
                    // para reducir ruido visual. El usuario sigue viendo el
                    // contador en el ícono de bandeja del header, y puede
                    // acceder a las sugerencias desde Nova → Bandeja.

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
                let shown = showAllEvents
                    ? displayEvents
                    : Array(displayEvents.prefix(visibleEventsLimit))
                let hiddenCount = displayEvents.count - shown.count

                VStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.element.id) { idx, event in
                        TimelineEventRow(
                            event: event,
                            isLast: idx == shown.count - 1 && hiddenCount == 0
                        )
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)

                if hiddenCount > 0 {
                    Button {
                        HapticManager.shared.tick()
                        withAnimation(.easeInOut(duration: 0.25)) {
                            showAllEvents = true
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Text("Ver \(hiddenCount) \(hiddenCount == 1 ? "bloque más" : "bloques más")")
                                .font(Theme.Typography.subheadEmphasized)
                                .foregroundStyle(Theme.Colors.focusAccent)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.Colors.focusAccent)
                        }
                        .padding(.vertical, Theme.Spacing.md - 2)
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.xs)
                }
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
                // Contador en tiempo real — se refresca cada 30s así "Queda
                // 1 h 36 min" decrece visiblemente sin esperar al boundary
                // de minuto. .periodic con 30s es suficiente granularidad para
                // texto al nivel de minuto.
                TimelineView(.periodic(from: .now, by: 30)) { context in
                    Text(countdownLabel(now: context.date))
                        .font(Theme.Typography.subhead)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
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

    /// Texto en español neutral mostrando cuánto falta para el evento o
    /// cuánto queda dentro de él. Formato h + min para que el usuario lea
    /// directamente la duración real (ej. "Queda 1 h 36 min" en vez de
    /// "Termina en 96 min").
    private func countdownLabel(now: Date) -> String {
        if let end = event.endTime, event.startTime <= now && end >= now {
            let totalMinutes = max(0, Int(end.timeIntervalSince(now) / 60))
            if totalMinutes == 0 { return "Termina ahora" }
            return "Queda " + formatDuration(minutes: totalMinutes)
        }
        let diffSeconds = event.startTime.timeIntervalSince(now)
        if diffSeconds <= 0 { return "Empezó ya" }
        let totalMinutes = Int(diffSeconds / 60)
        if totalMinutes == 0 { return "Empieza en menos de 1 min" }
        return "Empieza en " + formatDuration(minutes: totalMinutes)
    }

    private func formatDuration(minutes: Int) -> String {
        if minutes < 60 {
            return minutes == 1 ? "1 min" : "\(minutes) min"
        }
        let h = minutes / 60
        let m = minutes % 60
        let hLabel = h == 1 ? "1 h" : "\(h) h"
        if m == 0 { return hLabel }
        return "\(hLabel) \(m) min"
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

            VStack(alignment: .leading, spacing: 3) {
                Text(event.title)
                    .font(Theme.Typography.bodyEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)

                // Solo ubicación si hay. Notas/descripción quedan para detalle.
                if let loc = event.location, !loc.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin")
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.Colors.textTertiary)
                        Text(loc)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                            .lineLimit(1)
                    }
                }
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
