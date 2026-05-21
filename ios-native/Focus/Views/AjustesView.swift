import SwiftUI
import UserNotifications
import UIKit

struct AjustesView: View {
    @EnvironmentObject private var store: FocusDataStore
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var nav: NavigationCoordinator
    @EnvironmentObject private var coachMarks: CoachMarksStore
    @AppStorage("focus.v1.hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var showPersonalitySheet = false
    @State private var showResetConfirm = false
    @State private var showClearConfirm = false
    @State private var showSignOutConfirm = false
    @State private var calendarSheet: CalendarConnectionSheet? = nil
    /// Estado del permiso de notificaciones — se refresca cuando la vista
    /// aparece y después de pedir autorización.
    @State private var notificationStatus: UNAuthorizationStatus = .notDetermined

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
                        header
                            .padding(.horizontal, Theme.Spacing.xl)
                            // Padding superior `.lg` para mantener consistencia
                            // con Mi Día y dar aire al notch/Dynamic Island.
                            .padding(.top, Theme.Spacing.lg)

                        cuentaSection
                        sincronizacionSection
                        novaSection
                        calendariosSection
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
            .task {
                await refreshNotificationStatus()
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
            .sheet(item: $calendarSheet) { sheet in
                ComingSoonSheet(
                    title: sheet.title,
                    message: sheet.message,
                    icon: sheet.icon,
                    iconTint: sheet.tint
                )
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
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
        VStack(alignment: .leading, spacing: 6) {
            Text("Ajustes")
                .font(Theme.Typography.displayHero)
                .tracking(Theme.Tracking.displayHero)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("Tu cuenta, tu Nova, tus notificaciones.")
                .font(Theme.Typography.body)
                .tracking(Theme.Tracking.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    // MARK: - Sincronización (Bloque 3 — Supabase events/tasks)

    private var sincronizacionSection: some View {
        settingsSection(title: "Sincronización") {
            VStack(spacing: 0) {
                AjustesRow(
                    symbol: syncSymbol,
                    tint: syncTint,
                    title: syncTitle,
                    subtitle: syncSubtitle,
                    trailing: .nothing
                )
                Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                Button {
                    HapticManager.shared.tap()
                    Task { await store.fetchRemoteAndMerge() }
                } label: {
                    AjustesRow(
                        symbol: "arrow.triangle.2.circlepath",
                        tint: Theme.Colors.focusAccent,
                        title: "Sincronizar ahora",
                        subtitle: syncActionSubtitle,
                        trailing: .chevron
                    )
                }
                .buttonStyle(.plain)
                .disabled(!canSyncManually)
                .opacity(canSyncManually ? 1.0 : 0.5)
            }
            .focusCardContainer()
        }
    }

    private var syncSymbol: String {
        switch store.syncState {
        case .demo:        return "iphone.gen3"
        case .loggedOut:   return "iphone.gen3"
        case .idle:        return "checkmark.icloud"
        case .syncing:     return "arrow.triangle.2.circlepath"
        case .error:       return "exclamationmark.icloud"
        }
    }

    private var syncTint: Color {
        switch store.syncState {
        case .demo, .loggedOut: return Theme.Colors.textTertiary
        case .idle:             return Theme.Colors.success
        case .syncing:          return Theme.Colors.focusAccent
        case .error:            return Theme.Colors.warning
        }
    }

    private var syncTitle: String {
        switch store.syncState {
        case .demo:        return "Modo demo"
        case .loggedOut:   return "Sin sesión"
        case .idle:        return "Sincronizado"
        case .syncing:     return "Sincronizando…"
        case .error:       return "No se pudo sincronizar"
        }
    }

    private var syncSubtitle: String {
        switch store.syncState {
        case .demo:
            return "Solo en este iPhone. Inicia sesión para sincronizar."
        case .loggedOut:
            return "Sesión cerrada. Tus datos siguen en este iPhone."
        case .idle:
            if let date = store.lastSyncAt {
                return "Última sync: \(DateFormatters.hourMinute.string(from: date))"
            }
            return "Datos al día con Supabase."
        case .syncing:
            return "Subiendo cambios locales…"
        case .error(let msg):
            return msg
        }
    }

    private var syncActionSubtitle: String {
        if !canSyncManually {
            return "Inicia sesión para sincronizar."
        }
        return "Fuerza fetch + upload contra Supabase."
    }

    private var canSyncManually: Bool {
        store.syncCredentials != nil
    }

    // MARK: - Cuenta

    private var cuentaSection: some View {
        settingsSection(title: "Cuenta") {
            VStack(spacing: 0) {
                if auth.isLoggedIn {
                    AjustesRow(
                        symbol: "person.crop.circle.fill",
                        tint: Theme.Colors.focusAccent,
                        title: auth.displayName,
                        // Si hay nombre real (Google name / metadata),
                        // mostramos el email pequeño debajo como subtitle.
                        // Si NO hay nombre, el title ya ES el email — el
                        // subtitle pasa a "Sesión iniciada" como antes.
                        subtitle: auth.hasRealName
                            ? (auth.currentEmail ?? "")
                            : "Sesión iniciada",
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
                            subtitle: "Guarda tus datos en la nube y sincroniza entre dispositivos.",
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
                        subtitle: "\(store.pendingDisplaySuggestions.count) sugerencias pendientes",
                        trailing: .chevron
                    )
                }
                .buttonStyle(.plain)
            }
            .focusCardContainer()
        }
    }

    // MARK: - Calendarios conectados

    /// Lista de integraciones futuras. Todas abren un `ComingSoonSheet`
    /// honesto hasta que C5+ implemente la integración real (OAuth Google,
    /// EventKit Apple, parser .ics). Diseñadas para no parecer botones
    /// muertos: cada una explica qué va a poder hacer.
    private var calendariosSection: some View {
        settingsSection(title: "Calendarios conectados") {
            VStack(spacing: 0) {
                calendarRow(
                    symbol: "applelogo",
                    tint: Theme.Colors.textSecondary,
                    title: "Apple Calendar",
                    subtitle: "Importar eventos del calendario del sistema.",
                    sheet: CalendarConnectionSheet(
                        title: "Apple Calendar",
                        message: "Próximamente podrás traer tus eventos desde el calendario del iPhone usando EventKit. Nova los va a leer para sugerirte mejores bloques de foco.",
                        icon: "applelogo",
                        tint: Theme.Colors.textSecondary
                    )
                )
                Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                calendarRow(
                    symbol: "g.circle.fill",
                    tint: Color(red: 0.259, green: 0.522, blue: 0.957),
                    title: "Google Calendar",
                    subtitle: "Sincronizar agenda con tu cuenta Google.",
                    sheet: CalendarConnectionSheet(
                        title: "Google Calendar",
                        message: "Próximamente podrás conectar tu cuenta de Google con OAuth. Focus va a leer tus eventos y, si quieres, escribir los bloques de foco de vuelta.",
                        icon: "g.circle.fill",
                        tint: Color(red: 0.259, green: 0.522, blue: 0.957)
                    )
                )
                Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                calendarRow(
                    symbol: "doc.text.fill",
                    tint: Theme.Colors.focusAccent,
                    title: "Archivo .ics",
                    subtitle: "Importar/exportar archivos de calendario.",
                    sheet: CalendarConnectionSheet(
                        title: "Archivo .ics",
                        message: "Próximamente podrás importar un .ics (formato estándar de calendario) o exportar tu agenda como .ics para abrirla en cualquier otra app.",
                        icon: "doc.text.fill",
                        tint: Theme.Colors.focusAccent
                    )
                )
                Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                calendarRow(
                    symbol: "map.fill",
                    tint: Theme.Colors.warning,
                    title: "Ubicaciones (Maps / Waze)",
                    subtitle: "Abrir ubicaciones de eventos en mapas.",
                    sheet: CalendarConnectionSheet(
                        title: "Abrir ubicaciones",
                        message: "Más adelante podrás abrir las ubicaciones de tus eventos en Apple Maps, Google Maps o Waze con un tap. Por ahora la ubicación se guarda como texto.",
                        icon: "map.fill",
                        tint: Theme.Colors.warning
                    )
                )
            }
            .focusCardContainer()
        }
    }

    private func calendarRow(
        symbol: String,
        tint: Color,
        title: String,
        subtitle: String,
        sheet: CalendarConnectionSheet
    ) -> some View {
        Button {
            HapticManager.shared.tap()
            calendarSheet = sheet
        } label: {
            AjustesRow(
                symbol: symbol,
                tint: tint,
                title: title,
                subtitle: subtitle,
                trailing: .chevron
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Notificaciones

    private var notificacionesSection: some View {
        settingsSection(
            title: "Notificaciones",
            footer: "Focus usa notificaciones locales para recordarte eventos y tareas en este iPhone. No hay push remoto todavía."
        ) {
            VStack(spacing: 0) {
                // Estado real del permiso del sistema — la primera fila es la
                // que importa. Las demás filas son configuración aspiracional
                // (resumen / sugerencias) que sigue como toggle visual hasta
                // que se implemente realmente.
                permissionRow
                Divider().overlay(Theme.Colors.border).padding(.leading, 60)
                AjustesRow(
                    symbol: "bell.fill",
                    tint: Theme.Colors.warning,
                    title: "Recordatorios",
                    subtitle: "Avísame en la hora del evento.",
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
                    subtitle: "Cada mañana, tu día de un vistazo (próximamente).",
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
                    subtitle: "Nova te avisa cuando detecta algo útil (próximamente).",
                    trailing: .toggle(Binding(
                        get: { store.settings.smartSuggestionsEnabled },
                        set: { v in store.updateSettings { $0.smartSuggestionsEnabled = v } }
                    ))
                )
            }
            .focusCardContainer()
        }
    }

    /// Row dinámico según el estado del permiso de notificaciones del iPhone.
    /// - `.authorized` / `.provisional` / `.ephemeral` → muestra "Activadas".
    /// - `.notDetermined` → botón "Activar" que dispara `requestAuthorization`.
    /// - `.denied` → mensaje claro + botón "Abrir Ajustes del iPhone".
    @ViewBuilder
    private var permissionRow: some View {
        switch notificationStatus {
        case .authorized, .provisional, .ephemeral:
            AjustesRow(
                symbol: "checkmark.seal.fill",
                tint: Theme.Colors.success,
                title: "Permiso del iPhone",
                subtitle: "Activadas. Focus puede avisarte.",
                trailing: .nothing
            )
        case .notDetermined:
            Button {
                Task {
                    HapticManager.shared.tap()
                    _ = await LocalNotificationService.shared.requestAuthorization()
                    await refreshNotificationStatus()
                    // Si el usuario aceptó y hay recordatorios futuros,
                    // los programamos ahora.
                    if notificationStatus == .authorized && store.settings.remindersEnabled {
                        store.bootstrapLocalNotifications()
                    }
                }
            } label: {
                AjustesRow(
                    symbol: "bell.badge.fill",
                    tint: Theme.Colors.focusAccent,
                    title: "Permiso del iPhone",
                    subtitle: "Aún no solicitadas. Toca para activarlas.",
                    trailing: .nothing
                )
            }
            .buttonStyle(.plain)
        case .denied:
            Button {
                HapticManager.shared.tap()
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            } label: {
                AjustesRow(
                    symbol: "bell.slash.fill",
                    tint: Theme.Colors.warning,
                    title: "Permiso del iPhone",
                    subtitle: "Denegadas. Toca para abrir Ajustes del iPhone.",
                    trailing: .nothing
                )
            }
            .buttonStyle(.plain)
        @unknown default:
            AjustesRow(
                symbol: "bell.fill",
                tint: Theme.Colors.textTertiary,
                title: "Permiso del iPhone",
                subtitle: "Estado desconocido.",
                trailing: .nothing
            )
        }
    }

    /// Refresca el estado del permiso desde UNUserNotificationCenter.
    private func refreshNotificationStatus() async {
        let status = await LocalNotificationService.shared.currentStatus()
        await MainActor.run {
            self.notificationStatus = status
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

                Button {
                    HapticManager.shared.tap()
                    coachMarks.resetAll()
                    // Feedback breve: regresar a Mi Día para que el primer
                    // tip aparezca enseguida y el usuario vea el efecto.
                    nav.selectedTab = .miDia
                } label: {
                    AjustesRow(
                        symbol: "lightbulb",
                        tint: Theme.Colors.novaAccent,
                        title: "Ver consejos otra vez",
                        subtitle: "Los mini tutoriales contextuales volverán a aparecer.",
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
        footer: String? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text(title.uppercased()).sectionLabelStyle()
                .padding(.horizontal, Theme.Spacing.xl)
            content()
                .padding(.horizontal, Theme.Spacing.xl)
            if let footer {
                Text(footer)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, -Theme.Spacing.xs)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private extension View {
    // Theme 2.0: container con borderHairline en lugar de border sólido.
    // Las sections de Ajustes ahora se ven más "Linear-style".
    func focusCardContainer() -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(Theme.Colors.borderHairline, lineWidth: Theme.Stroke.hairline)
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
            // Theme 2.0: badge en captionMono UPPERCASE + tracking opinado.
            Text(text.uppercased())
                .font(Theme.Typography.captionMono)
                .tracking(Theme.Tracking.captionMono)
                .foregroundStyle(color)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    Capsule()
                        .fill(color.opacity(0.10))
                )
        case .toggle(let binding):
            // Theme 2.0: FocusToggle reemplaza UISwitch nativo. Track con
            // gradient FocusDeep cuando activo, en lugar del verde sistema.
            FocusToggle(isOn: binding)
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

// MARK: - Calendar connection sheet payload

/// Item identificable que dispara `ComingSoonSheet` desde las filas de
/// "Calendarios conectados". Cuando integraciones reales aterrizen (C5+),
/// estas filas pasarán a abrir su propio flujo en vez de este sheet.
struct CalendarConnectionSheet: Identifiable {
    let id = UUID()
    let title: String
    let message: String
    let icon: String
    let tint: Color
}

#Preview {
    AjustesView()
        .environmentObject(FocusDataStore())
}
