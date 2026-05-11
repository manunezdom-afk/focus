import SwiftUI

private enum InboxFilter: String, CaseIterable, Identifiable {
    case pending
    case approved
    case postponed

    var id: String { rawValue }

    var label: String {
        switch self {
        case .pending: return "Pendientes"
        case .approved: return "Aprobadas"
        case .postponed: return "Pospuestas"
        }
    }

    var matchingStatus: SuggestionStatus {
        switch self {
        case .pending: return .pending
        case .approved: return .approved
        case .postponed: return .postponed
        }
    }
}

struct NovaInboxView: View {
    @EnvironmentObject private var store: FocusDataStore
    @State private var filter: InboxFilter = .pending

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    header
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.top, Theme.Spacing.md)

                    filterRow
                        .padding(.horizontal, Theme.Spacing.xl)

                    if filtered.isEmpty {
                        EmptyStateView(
                            symbol: emptySymbol,
                            title: emptyTitle,
                            message: emptyMessage
                        )
                        .frame(minHeight: 320)
                    } else {
                        VStack(spacing: Theme.Spacing.md) {
                            ForEach(filtered) { sug in
                                NovaSuggestionCard(suggestion: sug) { status in
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                                        store.updateSuggestion(sug.id, status: status)
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, Theme.Spacing.xl)
                    }

                    Spacer(minLength: Theme.Spacing.bottomBarSafety)
                }
            }
        }
        .navigationTitle("Bandeja de Nova")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Colors.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Bandeja de Nova")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("Sugerencias inteligentes para tu día. Aprueba lo útil y descarta el resto.")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    // MARK: - Filtros

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(InboxFilter.allCases) { f in
                    FilterChip(label: f.label, isSelected: filter == f) {
                        filter = f
                    }
                }
            }
        }
    }

    private var filtered: [NovaSuggestion] {
        store.suggestions
            .filter { $0.status == filter.matchingStatus }
            .sorted { $0.createdAt > $1.createdAt }
    }

    // MARK: - Empty

    private var emptySymbol: String {
        switch filter {
        case .pending: return "checkmark.seal"
        case .approved: return "tray"
        case .postponed: return "clock"
        }
    }

    private var emptyTitle: String {
        switch filter {
        case .pending: return "Bandeja vacía"
        case .approved: return "Sin sugerencias aprobadas"
        case .postponed: return "Nada pospuesto"
        }
    }

    private var emptyMessage: String {
        switch filter {
        case .pending: return "Nova no tiene nada urgente para ti ahora. Cuando detecte algo útil, va a aparecer aquí."
        case .approved: return "Cuando apruebes una sugerencia, va a quedar registrada aquí."
        case .postponed: return "Las sugerencias que pospongas van a volver a aparecer más tarde."
        }
    }
}

// MARK: - Card de sugerencia

struct NovaSuggestionCard: View {
    let suggestion: NovaSuggestion
    let onAction: (SuggestionStatus) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(alignment: .top, spacing: Theme.Spacing.md) {
                IconBadge(symbol: suggestion.kind.symbol, tint: suggestion.kind.accent, size: 38)

                VStack(alignment: .leading, spacing: 4) {
                    Text(suggestion.title)
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 6) {
                        StatePill(label: suggestion.kind.displayName, tint: suggestion.kind.accent)
                        if suggestion.priority == .high {
                            StatePill(label: "Alta", tint: Theme.Colors.priorityHigh)
                        }
                    }
                }

                Spacer()
            }

            Text(suggestion.detail)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.leading)

            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "arrow.right.circle")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Colors.textTertiary)
                Text(suggestion.suggestedAction)
                    .font(Theme.Typography.subheadEmphasized)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }

            if suggestion.status == .pending {
                actionRow
            } else {
                resolvedBanner
            }
        }
        .padding(Theme.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.surfaceElevated)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                )
        )
    }

    private var actionRow: some View {
        HStack(spacing: Theme.Spacing.sm) {
            actionButton(
                label: "Descartar",
                symbol: "xmark",
                tint: Theme.Colors.textSecondary,
                fill: Theme.Colors.surface,
                action: { onAction(.dismissed) }
            )
            actionButton(
                label: "Posponer",
                symbol: "clock",
                tint: Theme.Colors.warning,
                fill: Theme.Colors.warning.opacity(0.14),
                action: { onAction(.postponed) }
            )
            actionButton(
                label: "Aprobar",
                symbol: "checkmark",
                tint: Theme.Colors.success,
                fill: Theme.Colors.success.opacity(0.16),
                emphasized: true,
                action: { onAction(.approved) }
            )
        }
        .padding(.top, Theme.Spacing.xs)
    }

    private func actionButton(
        label: String,
        symbol: String,
        tint: Color,
        fill: Color,
        emphasized: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: {
            HapticManager.shared.tap()
            action()
        }) {
            HStack(spacing: 6) {
                Image(systemName: symbol)
                    .font(.system(size: 12, weight: .semibold))
                Text(label)
                    .font(Theme.Typography.subheadEmphasized)
            }
            .foregroundStyle(emphasized ? Theme.Colors.textPrimary : tint)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.md - 2)
            .background(
                Capsule()
                    .fill(fill)
                    .overlay(
                        Capsule()
                            .strokeBorder(tint.opacity(emphasized ? 0.45 : 0.30), lineWidth: Theme.Stroke.hairline)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private var resolvedBanner: some View {
        HStack(spacing: 6) {
            Image(systemName: resolvedSymbol)
                .font(.system(size: 11, weight: .semibold))
            Text(resolvedLabel)
                .font(Theme.Typography.subheadEmphasized)
            Spacer()
            if let resolved = suggestion.resolvedAt {
                Text(timeAgo(from: resolved))
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textQuaternary)
            }
        }
        .foregroundStyle(resolvedTint)
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm)
        .background(
            Capsule()
                .fill(resolvedTint.opacity(0.12))
                .overlay(
                    Capsule()
                        .strokeBorder(resolvedTint.opacity(0.30), lineWidth: Theme.Stroke.hairline)
                )
        )
    }

    private var resolvedSymbol: String {
        switch suggestion.status {
        case .approved: return "checkmark.seal.fill"
        case .postponed: return "clock"
        case .dismissed: return "xmark.circle"
        case .pending: return "circle"
        }
    }

    private var resolvedLabel: String {
        switch suggestion.status {
        case .approved: return "Aprobada"
        case .postponed: return "Pospuesta"
        case .dismissed: return "Descartada"
        case .pending: return "Pendiente"
        }
    }

    private var resolvedTint: Color {
        switch suggestion.status {
        case .approved: return Theme.Colors.success
        case .postponed: return Theme.Colors.warning
        case .dismissed: return Theme.Colors.textTertiary
        case .pending: return Theme.Colors.novaAccent
        }
    }

    private func timeAgo(from date: Date) -> String {
        let secs = Int(Date().timeIntervalSince(date))
        if secs < 60 { return "ahora" }
        if secs < 3600 { return "hace \(secs/60) min" }
        if secs < 86400 { return "hace \(secs/3600)h" }
        return "hace \(secs/86400) días"
    }
}

#Preview {
    NavigationStack {
        NovaInboxView()
            .environmentObject(FocusDataStore())
    }
    .preferredColorScheme(.dark)
}
