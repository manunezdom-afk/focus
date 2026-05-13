import SwiftUI

enum InboxFilter: String, CaseIterable, Identifiable {
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

/// Standalone (con NavigationStack propio). Usar desde Ajustes → Bandeja.
struct NovaInboxView: View {
    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()
            NovaInboxContent()
        }
        .navigationTitle("Bandeja de Nova")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Colors.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}

/// Contenido sin navegación. Usar dentro del tab Nova.
/// Habla directo con el store y con el toast — al aprobar una sugerencia
/// `.schedule`/`.task` crea la entidad real y notifica al usuario.
struct NovaInboxContent: View {
    @EnvironmentObject private var store: FocusDataStore
    @EnvironmentObject private var toast: ToastManager
    @State private var filter: InboxFilter = .pending

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
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
                    .frame(minHeight: 280)
                } else {
                    VStack(spacing: Theme.Spacing.md) {
                        ForEach(filtered) { sug in
                            NovaSuggestionCard(suggestion: sug) { status in
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                                    handleAction(suggestion: sug, status: status)
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

    /// Despacha la acción del card al método correcto del store y muestra el
    /// toast adecuado según el resultado. Si la sugerencia viene del fallback
    /// demo (no está en el store), la copia al store antes de actuar — así la
    /// acción persiste y el card desaparece de la lista filtrada.
    private func handleAction(suggestion: NovaSuggestion, status: SuggestionStatus) {
        let isInStore = store.suggestions.contains(where: { $0.id == suggestion.id })
        if !isInStore {
            // Persistir la sugerencia demo antes de actuar.
            store.addSuggestion(suggestion)
        }

        switch status {
        case .approved:
            let result = store.approveSuggestion(suggestion.id)
            switch result {
            case .eventCreated(let event):
                toast.success("Evento agendado · \(event.title)", symbol: "calendar.badge.plus")
            case .taskCreated:
                toast.success("Tarea creada")
            case .acknowledged:
                toast.show(.info("Sugerencia aprobada", symbol: "checkmark.circle.fill"))
            }
        case .postponed:
            store.updateSuggestion(suggestion.id, status: .postponed)
            toast.show(.info("Pospuesta para más tarde", symbol: "clock"))
        case .dismissed:
            store.updateSuggestion(suggestion.id, status: .dismissed)
        case .pending:
            break
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Sugerencias inteligentes")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("Nova mira tu día y te propone ajustes. Aprueba lo útil, descarta el resto.")
                .font(Theme.Typography.subhead)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

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
        // `displaySuggestions` ya filtra stales y devuelve fallback de demo
        // cuando no hay datos del usuario. La Bandeja nunca debe mostrar
        // sugerencias que referencian items inexistentes.
        store.displaySuggestions
            .filter { $0.status == filter.matchingStatus }
            .sorted { $0.createdAt > $1.createdAt }
    }

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
        case .approved: return "Aún nada aprobado"
        case .postponed: return "Nada pospuesto"
        }
    }

    private var emptyMessage: String {
        switch filter {
        case .pending:
            return "Cuando agregues eventos o tareas, Nova te propondrá ajustes aquí. Prueba «organiza mi día» o «preparar mañana» desde el FocusBar."
        case .approved:
            return "Cuando apruebes una sugerencia, va a quedar registrada aquí."
        case .postponed:
            return "Las sugerencias pospuestas vuelven a aparecer más tarde."
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
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                )
                .focusCardShadow()
        )
    }

    private var actionRow: some View {
        HStack(spacing: Theme.Spacing.sm) {
            actionButton(
                label: "Descartar",
                symbol: "xmark",
                tint: Theme.Colors.textSecondary,
                fill: Theme.Colors.surfaceHigh,
                action: { onAction(.dismissed) }
            )
            actionButton(
                label: "Posponer",
                symbol: "clock",
                tint: Theme.Colors.warning,
                fill: Theme.Colors.warning.opacity(0.10),
                action: { onAction(.postponed) }
            )
            actionButton(
                label: "Aprobar",
                symbol: "checkmark",
                tint: Theme.Colors.success,
                fill: Theme.Colors.success,
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
            .foregroundStyle(emphasized ? .white : tint)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.md - 2)
            .background(
                Capsule()
                    .fill(fill)
                    .overlay(
                        Capsule()
                            .strokeBorder(
                                emphasized ? Color.clear : tint.opacity(0.20),
                                lineWidth: Theme.Stroke.hairline
                            )
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
                .fill(resolvedTint.opacity(0.10))
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
        case .pending: return Theme.Colors.focusAccent
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
}
