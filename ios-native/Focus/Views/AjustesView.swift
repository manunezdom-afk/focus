import SwiftUI

struct AjustesView: View {
    @EnvironmentObject private var store: FocusDataStore
    @EnvironmentObject private var auth: AuthStore
    @AppStorage("focus.v1.hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var showPersonalitySheet = false
    @State private var showResetConfirm = false
    @State private var showClearConfirm = false
    @State private var showSignOutConfirm = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
                        header
                            .padding(.horizontal, Theme.Spacing.xl)
                            .padding(.top, Theme.Spacing.md)

                        cuentaSection
                        novaSection
                        notificacionesSection
                        aparienciaSection
                        privacidadSection
                        datosLocalesSection
                        acercaSection
                        brandFooter
                            .padding(.horizontal, Theme.Spacing.xl)
                            .padding(.top, Theme.Spacing.lg)

                        Spacer(minLength: Theme.Spacing.bottomBarSafety)
                    }
                }
            }
            .sheet(isPresented: $showPersonalitySheet) {
                PersonalitySheet(
                    selected: store.settings.novaPersonality
                ) { personality in
                    store.updateSettings { $0.novaPersonality = personality }
                }
                .presentationDetents([.medium])
                .presentationBackground(Theme.Colors.background)
            }
            .confirmationDialog(
                "Restablecer datos demo",
                isPresented: $showResetConfirm,
                titleVisibility: .visible
            ) {
                Button("Restablecer", role: .destructive) {
                    store.resetToDemoState()
                }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Vuelves al estado inicial con datos de ejemplo. Tus tareas, eventos y conversación con Nova creados se borran de este iPhone.")
            }
            .confirmationDialog(
                "Borrar datos locales",
                isPresented: $showClearConfirm,
                titleVisibility: .visible
            ) {
                Button("Borrar todo", role: .destructive) {
                    store.clearAllLocalData()
                }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Elimina TODOS los datos locales: tareas, eventos, sugerencias, conversación de Nova y ajustes. La próxima vez que abras la app, vuelven los datos de ejemplo.")
            }
            .confirmationDialog(
                "Cerrar sesión",
                isPresented: $showSignOutConfirm,
                titleVisibility: .visible
            ) {
                Button("Cerrar sesión", role: .destructive) {
                    auth.signOut()
                }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Vas a salir de tu cuenta. Tus datos locales en este iPhone no se borran.")
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Ajustes")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("Tu cuenta, tu Nova, tus notificaciones.")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    // MARK: - Cuenta

    private var cuentaSection: some View {
        settingsSection(title: "Cuenta") {
            VStack(spacing: 0) {
                if auth.isLoggedIn {
                    AjustesRow(
                        symbol: "person.crop.circle.fill",
                        tint: Theme.Colors.focusAccent,
                        title: auth.currentEmail ?? "Sesión activa",
                        subtitle: "Sesión iniciada",
                        trailing: .badge("Activa", Theme.Colors.success)
                    )
                    Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                    Button {
                        HapticManager.shared.tap()
                        showSignOutConfirm = true
                    } label: {
                        AjustesRow(
                            symbol: "rectangle.portrait.and.arrow.right",
                            tint: Theme.Colors.danger,
                            title: "Cerrar sesión",
                            subtitle: "Tus datos locales no se borran.",
                            trailing: .chevron
                        )
                    }
                    .buttonStyle(.plain)
                } else {
                    AjustesRow(
                        symbol: "person.crop.circle",
                        tint: Theme.Colors.textSecondary,
                        title: "Modo demo",
                        subtitle: "Sin sesión. Tus datos viven solo en este iPhone.",
                        trailing: .nothing
                    )
                    Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                    Button {
                        HapticManager.shared.tap()
                        auth.exitDemo()
                    } label: {
                        AjustesRow(
                            symbol: "key.fill",
                            tint: Theme.Colors.focusAccent,
                            title: "Iniciar sesión",
                            subtitle: "Guardá tus datos en la nube y sincronizá entre dispositivos.",
                            trailing: .chevron
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .focusCardContainer()
        }
    }

    // MARK: - Plan

    private var planSection: some View {
        settingsSection(title: "Plan") {
            VStack(spacing: 0) {
                AjustesRow(
                    symbol: "sparkles",
                    tint: Theme.Colors.novaAccent,
                    title: auth.isLoggedIn ? "Early Access" : "Modo demo",
                    subtitle: auth.isLoggedIn
                        ? "Estás probando Focus pre-lanzamiento."
                        : "Tus datos viven solo en este iPhone.",
                    trailing: .nothing
                )
            }
            .focusCardContainer()
        }
    }

    // MARK: - Nova

    private var novaSection: some View {
        settingsSection(title: "Nova") {
            VStack(spacing: 0) {
                Button {
                    HapticManager.shared.tap()
                    showPersonalitySheet = true
                } label: {
                    AjustesRow(
                        symbol: "bubble.left.and.bubble.right",
                        tint: Theme.Colors.novaAccent,
                        title: "Personalidad",
                        subtitle: store.settings.novaPersonality.displayName,
                        trailing: .chevron
                    )
                }
                .buttonStyle(.plain)

                Divider().overlay(Theme.Colors.border).padding(.leading, 60)

                AjustesRow(
                    symbol: "brain",
                    tint: Theme.Colors.novaAccent,
                    title: "Memoria",
                    subtitle: "Nova recuerda tus preferencias.",
                    trailing: .toggle(Binding(
                        get: { store.settings.novaMemoryEnabled },
                        set: { v in store.updateSettings { $0.novaMemoryEnabled = v } }
                    ))
                )

                Divider().overlay(Theme.Colors.border).padding(.leading, 60)

                AjustesRow(
                    symbol: "mic",
                    tint: Theme.Colors.novaAccent,
                    title: "Voz",
                    subtitle: "Habla con Nova en lugar de escribir.",
                    trailing: .toggle(Binding(
                        get: { store.settings.novaVoiceEnabled },
                        set: { v in store.updateSettings { $0.novaVoiceEnabled = v } }
                    ))
                )

                Divider().overlay(Theme.Colors.border).padding(.leading, 60)

                NavigationLink {
                    NovaInboxView()
                } label: {
                    AjustesRow(
                        symbol: "tray.full",
                        tint: Theme.Colors.novaAccent,
                        title: "Bandeja de Nova",
                        subtitle: "\(store.pendingSuggestions.count) sugerencias pendientes",
                        trailing: .chevron
                    )
                }
                .buttonStyle(.plain)
            }
            .focusCardContainer()
        }
    }

    // MARK: - Notificaciones

    private var notificacionesSection: some View {
        settingsSection(title: "Notificaciones") {
            VStack(spacing: 0) {
                AjustesRow(
                    symbol: "bell.fill",
                    tint: Theme.Colors.warning,
                    title: "Recordatorios",
                    subtitle: "10 minutos antes de cada evento.",
                    trailing: .toggle(Binding(
                        get: { store.settings.remindersEnabled },
                        set: { v in store.updateSettings { $0.remindersEnabled = v } }
                    ))
                )
                Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                AjustesRow(
                    symbol: "sun.max.fill",
                    tint: Theme.Colors.warning,
                    title: "Resumen diario",
                    subtitle: "Cada mañana, tu día de un vistazo.",
                    trailing: .toggle(Binding(
                        get: { store.settings.dailySummaryEnabled },
                        set: { v in store.updateSettings { $0.dailySummaryEnabled = v } }
                    ))
                )
                Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                AjustesRow(
                    symbol: "sparkles",
                    tint: Theme.Colors.novaAccent,
                    title: "Sugerencias inteligentes",
                    subtitle: "Nova te avisa cuando detecta algo útil.",
                    trailing: .toggle(Binding(
                        get: { store.settings.smartSuggestionsEnabled },
                        set: { v in store.updateSettings { $0.smartSuggestionsEnabled = v } }
                    ))
                )
            }
            .focusCardContainer()
        }
    }

    // MARK: - Apariencia

    private var aparienciaSection: some View {
        settingsSection(title: "Apariencia") {
            VStack(spacing: 0) {
                ForEach(Array(AppearancePreference.allCases.enumerated()), id: \.element) { idx, pref in
                    Button {
                        HapticManager.shared.tick()
                        store.updateSettings { $0.appearance = pref }
                    } label: {
                        AjustesRow(
                            symbol: appearanceSymbol(pref),
                            tint: Theme.Colors.focusAccent,
                            title: pref.displayName,
                            subtitle: appearanceSubtitle(pref),
                            trailing: store.settings.appearance == pref ? .check : .nothing
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(pref == .dark)
                    .opacity(pref == .dark ? 0.45 : 1)
                    if idx < AppearancePreference.allCases.count - 1 {
                        Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                    }
                }
            }
            .focusCardContainer()
        }
    }

    private func appearanceSymbol(_ pref: AppearancePreference) -> String {
        switch pref {
        case .system: return "circle.righthalf.filled"
        case .dark: return "moon.fill"
        case .light: return "sun.max"
        }
    }

    private func appearanceSubtitle(_ pref: AppearancePreference) -> String {
        switch pref {
        case .system: return "Sigue lo que use tu iPhone."
        case .light: return "Claro siempre."
        case .dark: return "Oscuro próximamente."
        }
    }

    // MARK: - Privacidad

    private var privacidadSection: some View {
        settingsSection(title: "Privacidad") {
            VStack(spacing: 0) {
                AjustesRow(
                    symbol: "lock.shield",
                    tint: Theme.Colors.success,
                    title: "Tus datos",
                    subtitle: "Hoy todo vive en este iPhone. Nada sale sin que lo apruebes.",
                    trailing: .nothing
                )
                Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                // Privacidad y eliminación de cuenta requieren backend real
                // (Supabase + endpoint de delete). Mientras tanto se muestran
                // como "Próximamente" para no prometer algo que no funciona.
                AjustesRow(
                    symbol: "doc.text",
                    tint: Theme.Colors.textSecondary,
                    title: "Política de privacidad",
                    subtitle: "Próximamente disponible.",
                    trailing: .nothing
                )
                .opacity(0.55)
                Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                AjustesRow(
                    symbol: "trash",
                    tint: Theme.Colors.textTertiary,
                    title: "Eliminar cuenta",
                    subtitle: "Próximamente. Por ahora puedes borrar tus datos locales debajo.",
                    trailing: .nothing
                )
                .opacity(0.55)
            }
            .focusCardContainer()
        }
    }

    // MARK: - Datos locales

    private var datosLocalesSection: some View {
        settingsSection(title: "Datos locales") {
            VStack(spacing: 0) {
                Button {
                    HapticManager.shared.tap()
                    showResetConfirm = true
                } label: {
                    AjustesRow(
                        symbol: "arrow.counterclockwise.circle",
                        tint: Theme.Colors.focusAccent,
                        title: "Restablecer datos demo",
                        subtitle: "Vuelve al estado inicial con datos de ejemplo.",
                        trailing: .chevron
                    )
                }
                .buttonStyle(.plain)

                Divider().overlay(Theme.Colors.border).padding(.leading, 60)

                Button {
                    HapticManager.shared.tap()
                    showClearConfirm = true
                } label: {
                    AjustesRow(
                        symbol: "trash",
                        tint: Theme.Colors.danger,
                        title: "Borrar datos locales",
                        subtitle: "Elimina tareas, eventos y conversación de este iPhone.",
                        trailing: .chevron
                    )
                }
                .buttonStyle(.plain)
            }
            .focusCardContainer()
        }
    }

    // MARK: - Brand footer

    private var brandFooter: some View {
        VStack(spacing: Theme.Spacing.md) {
            FocusLogoMark(size: 56)
                .padding(.bottom, Theme.Spacing.xs)
            Text("Focus")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Colors.textPrimary)
                .tracking(0.2)
            Text(AppVersion.displayString)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary)
            Text("Hecho para organizar tu día con Nova.")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Acerca

    private var acercaSection: some View {
        settingsSection(title: "Acerca de") {
            VStack(spacing: 0) {
                Button {
                    HapticManager.shared.tap()
                    hasSeenOnboarding = false
                } label: {
                    AjustesRow(
                        symbol: "play.rectangle",
                        tint: Theme.Colors.focusAccent,
                        title: "Ver tutorial otra vez",
                        subtitle: "Repasá el onboarding de bienvenida.",
                        trailing: .chevron
                    )
                }
                .buttonStyle(.plain)

                Divider().overlay(Theme.Colors.border).padding(.leading, 60)

                AjustesRow(
                    symbol: "info.circle",
                    tint: Theme.Colors.textSecondary,
                    title: "Focus",
                    subtitle: "\(AppVersion.displayString) · Hecho para organizar tu día con Nova.",
                    trailing: .nothing
                )
            }
            .focusCardContainer()
        }
    }

    // MARK: - Helper

    private func settingsSection<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text(title.uppercased()).sectionLabelStyle()
                .padding(.horizontal, Theme.Spacing.xl)
            content()
                .padding(.horizontal, Theme.Spacing.xl)
        }
    }
}

private extension View {
    func focusCardContainer() -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
                    .focusCardShadow()
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
    }
}

private enum AjustesTrailing {
    case chevron
    case nothing
    case check
    case badge(String, Color)
    case toggle(Binding<Bool>)
}

private struct AjustesRow: View {
    let symbol: String
    let tint: Color
    let title: String
    let subtitle: String?
    let trailing: AjustesTrailing

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            IconBadge(symbol: symbol, tint: tint, size: 34)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Theme.Typography.bodyEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                        .lineLimit(2)
                }
            }

            Spacer()

            trailingView
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.md)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var trailingView: some View {
        switch trailing {
        case .chevron:
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.textTertiary)
        case .check:
            Image(systemName: "checkmark")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Colors.focusAccent)
        case .badge(let text, let color):
            Text(text.uppercased())
                .font(Theme.Typography.caption)
                .tracking(0.6)
                .foregroundStyle(color)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    Capsule()
                        .fill(color.opacity(0.10))
                )
        case .toggle(let binding):
            Toggle("", isOn: binding)
                .labelsHidden()
                .tint(Theme.Colors.focusAccent)
        case .nothing:
            EmptyView()
        }
    }
}

// MARK: - Sheet de personalidad

private struct PersonalitySheet: View {
    let selected: NovaPersonality
    let onSelect: (NovaPersonality) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var local: NovaPersonality

    init(selected: NovaPersonality, onSelect: @escaping (NovaPersonality) -> Void) {
        self.selected = selected
        self.onSelect = onSelect
        _local = State(initialValue: selected)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()

                VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                    Text("Elige cómo te habla Nova.")
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.top, Theme.Spacing.md)

                    VStack(spacing: Theme.Spacing.sm) {
                        ForEach(NovaPersonality.allCases) { p in
                            Button {
                                HapticManager.shared.tick()
                                local = p
                                onSelect(p)
                            } label: {
                                HStack(spacing: Theme.Spacing.md) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(p.displayName)
                                            .font(Theme.Typography.bodyEmphasized)
                                            .foregroundStyle(Theme.Colors.textPrimary)
                                        Text(p.description)
                                            .font(Theme.Typography.subhead)
                                            .foregroundStyle(Theme.Colors.textSecondary)
                                    }
                                    Spacer()
                                    if local == p {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(Theme.Colors.focusAccent)
                                    }
                                }
                                .padding(Theme.Spacing.lg)
                                .background(
                                    RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                                        .fill(Theme.Colors.surface)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                                                .strokeBorder(
                                                    local == p ? Theme.Colors.focusAccent.opacity(0.45) : Theme.Colors.border,
                                                    lineWidth: Theme.Stroke.hairline
                                                )
                                        )
                                        .focusCardShadow()
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.xl)

                    Spacer()
                }
            }
            .navigationTitle("Personalidad de Nova")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Listo") { dismiss() }
                        .foregroundStyle(Theme.Colors.focusAccent)
                }
            }
        }
    }
}

#Preview {
    AjustesView()
        .environmentObject(FocusDataStore())
}
