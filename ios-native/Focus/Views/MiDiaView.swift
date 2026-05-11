import SwiftUI

struct MiDiaView: View {
    @EnvironmentObject private var store: FocusDataStore
    @EnvironmentObject private var nav: NavigationCoordinator
    @State private var focusBarText: String = ""
    @State private var showAllEvents: Bool = false

    /// 3 bloques visibles por defecto — más allá de eso es ruido.
    private let visibleEventsLimit: Int = 3

    /// 3 tareas pendientes visibles en Mi Día — el resto vive en Nova.
    private let visiblePendingTasksLimit: Int = 3

    // MARK: - Source of truth

    /// Eventos visibles: del usuario si tiene, demo si no.
    private var displayEvents: [FocusEvent] {
        if store.hasUserEvents {
            return store.todayEvents()
        }
        return DemoDataProvider.shared.exampleTodayEvents()
    }

    /// Pendientes visibles: del usuario si tiene, demo si no.
    private var displayPendingTasks: [FocusTask] {
        if store.hasUserTasks {
            return store.pendingTodayTasks
        }
        return DemoDataProvider.shared.exampleTodayTasks().filter { !$0.done }
    }

    private var nextBlock: FocusEvent? {
        let now = Date()
        return displayEvents.first { ($0.endTime ?? $0.startTime) >= now }
    }

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            // Hero zone: gradiente sutil detrás del header — identidad de Mi Día.
            VStack(spacing: 0) {
                LinearGradient(
                    colors: [
                        Theme.Colors.focusAccent.opacity(0.08),
                        Theme.Colors.background
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 300)
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

                    if let next = nextBlock {
                        ProximoBloqueCard(event: next)
                            .padding(.horizontal, Theme.Spacing.xl)
                    }

                    timelineSection

                    pendingTasksSection

                    Spacer(minLength: Theme.Spacing.bottomBarSafety)
                }
                .padding(.top, Theme.Spacing.sm)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                FocusBrandRow()
                Spacer()
                HStack(spacing: Theme.Spacing.sm) {
                    bandejaButton
                    profileButton
                }
            }
            Text("Mi Día")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
        }
    }

    private var bandejaButton: some View {
        Button {
            HapticManager.shared.tap()
            nav.openNova(segment: .bandeja)
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
        .accessibilityLabel("Bandeja de Nova")
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
                nav.openNova(prompt: text)
            },
            onTap: {
                if focusBarText.isEmpty {
                    nav.openNova(segment: .bandeja)
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
                    action: { nav.openNova() }
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

    // MARK: - Pendientes de hoy (compacto)

    /// Sección compacta — máximo 3 pendientes. Si hay más o el usuario quiere
    /// la lista completa, se delega a Nova → Acciones → Todas las tareas.
    @ViewBuilder
    private var pendingTasksSection: some View {
        let pending = displayPendingTasks
        let shown = Array(pending.prefix(visiblePendingTasksLimit))
        let extra = pending.count - shown.count

        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text("PENDIENTES DE HOY")
                    .sectionLabelStyle()
                Spacer()
                Text(pendingHeaderTrailing(count: pending.count))
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .tracking(0.3)
            }
            .padding(.horizontal, Theme.Spacing.xl)

            if shown.isEmpty {
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
                    ForEach(shown) { task in
                        MiDiaTaskRow(task: task) {
                            store.toggleTask(task.id)
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)

                if extra > 0 {
                    Button {
                        HapticManager.shared.tap()
                        nav.openNova(segment: .acciones)
                    } label: {
                        HStack(spacing: 6) {
                            Text(extra == 1
                                 ? "Ver 1 más en Nova"
                                 : "Ver \(extra) más en Nova")
                                .font(Theme.Typography.subheadEmphasized)
                                .foregroundStyle(Theme.Colors.focusAccent)
                            Image(systemName: "arrow.right")
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

    private func pendingHeaderTrailing(count: Int) -> String {
        if count == 0 { return "Todo listo" }
        if count == 1 { return "1 pendiente" }
        return "\(count) pendientes"
    }
}

// MARK: - Próximo bloque (con contador tiempo real azul)

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
                // Contador en tiempo real (segundo a segundo, en azul) —
                // el usuario ve exactamente cuánto falta sin que parezca un
                // texto estático.
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text(countdownLabel(now: context.date))
                        .font(Theme.Typography.subheadEmphasized)
                        .foregroundStyle(Theme.Colors.focusAccent)
                        .monospacedDigit()
                        .contentTransition(.numericText(countsDown: true))
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

    /// Texto del contador con h + min + s. Si hay >0 horas/minutos, los
    /// muestra; los segundos siempre se muestran para reforzar el tick.
    private func countdownLabel(now: Date) -> String {
        if let end = event.endTime, event.startTime <= now && end >= now {
            let secs = max(0, Int(end.timeIntervalSince(now)))
            if secs == 0 { return "Termina ahora" }
            return "Queda " + formatHMS(seconds: secs)
        }
        let diffSeconds = event.startTime.timeIntervalSince(now)
        if diffSeconds <= 0 { return "Empezó ya" }
        return "Empieza en " + formatHMS(seconds: Int(diffSeconds))
    }

    private func formatHMS(seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        var parts: [String] = []
        if h > 0 { parts.append("\(h) h") }
        if m > 0 || h > 0 { parts.append("\(m) min") }
        parts.append("\(s) s")
        return parts.joined(separator: " ")
    }
}

// MARK: - Timeline row

private struct TimelineEventRow: View {
    let event: FocusEvent
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            // Hora a la izquierda
            VStack(alignment: .trailing, spacing: 2) {
                Text(event.timeRangeLabel.components(separatedBy: " ").first ?? "")
                    .font(Theme.Typography.captionEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                if let dur = event.durationLabel {
                    Text(dur)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                }
            }
            .frame(width: 50, alignment: .trailing)

            // Bullet + línea
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .stroke(event.section.color.opacity(0.5), lineWidth: 1.5)
                        .frame(width: 10, height: 10)
                    Circle()
                        .fill(event.section.color)
                        .frame(width: 5, height: 5)
                }
                if !isLast {
                    Rectangle()
                        .fill(Theme.Colors.border)
                        .frame(width: 1)
                        .padding(.top, 2)
                }
            }

            // Card del evento
            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(Theme.Typography.bodyEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(2)

                HStack(spacing: 4) {
                    Image(systemName: event.section.symbol)
                        .font(.system(size: 10))
                        .foregroundStyle(event.section.color)
                    Text(event.section.displayName)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                    if let loc = event.location, !loc.isEmpty {
                        Text("·").foregroundStyle(Theme.Colors.textQuaternary)
                        Text(loc)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                            .lineLimit(1)
                    }
                }
            }
            .padding(.vertical, Theme.Spacing.sm)
            .padding(.horizontal, Theme.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
            )
            .padding(.bottom, isLast ? 0 : Theme.Spacing.sm)
        }
    }
}

// MARK: - Task row compacto (sin subtareas inline)

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
                    .font(.system(size: 20))
                    .foregroundStyle(task.done ? Theme.Colors.success : Theme.Colors.textTertiary)

                Circle()
                    .fill(task.priority.color)
                    .frame(width: 6, height: 6)
                    .opacity(task.done ? 0.4 : 1)

                VStack(alignment: .leading, spacing: 1) {
                    Text(task.title)
                        .font(Theme.Typography.bodyEmphasized)
                        .foregroundStyle(task.done ? Theme.Colors.textTertiary : Theme.Colors.textPrimary)
                        .strikethrough(task.done, color: Theme.Colors.textTertiary)
                        .multilineTextAlignment(.leading)
                    if task.hasSubtasks {
                        Text("\(task.completedSubtaskCount)/\(task.subtasks.count) subtareas")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                    }
                }

                Spacer()
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.vertical, Theme.Spacing.sm + 2)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
                    .focusCardShadow()
            )
        }
        .buttonStyle(.plain)
    }
}
