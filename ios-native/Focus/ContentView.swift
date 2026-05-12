import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var auth: AuthStore
    @AppStorage("focus.v1.hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var isBooting = true

    /// Estado de navegación raíz como UN solo valor. Antes había 3
    /// `.animation(value:)` modifiers separados (`isBooting`,
    /// `hasSeenOnboarding`, `auth.isAuthenticatedOrDemo`) que disparaban
    /// crossfades simultáneos cuando dos cambiaban juntos (típico al
    /// terminar onboarding: `hasSeenOnboarding=true` + `auth.enterDemo()`
    /// en el mismo turno). El resultado eran capas duplicadas en pantalla
    /// — Onboarding + Login mezclados. Con un solo `route` computado y
    /// un switch sin animaciones, SwiftUI hace swap atómico — solo una
    /// pantalla visible nunca.
    enum Route: Hashable {
        case boot
        case onboarding
        case login
        case main
    }

    private var route: Route {
        if isBooting { return .boot }
        // Refresh-token / init aún resolviendo: BootView en vez de
        // parpadear Login. Mismo treatment que .boot.
        if case .loading = auth.state { return .boot }
        // Si ya está autenticado o en demo, NUNCA mostrar onboarding —
        // aunque hasSeenOnboarding sea false. Cubre el caso de
        // reinstalación de la app con Keychain preservado: el
        // @AppStorage no sobrevive al reinstall, pero la sesión en
        // Keychain sí. Sin esta defensa el usuario logueado vería el
        // onboarding como si fuera primera vez.
        if auth.isAuthenticatedOrDemo {
            if !hasSeenOnboarding {
                // Auto-marcar onboarding como visto para que en futuros
                // launches el routing sea directo.
                DispatchQueue.main.async { hasSeenOnboarding = true }
            }
            return .main
        }
        if !hasSeenOnboarding { return .onboarding }
        return .login
    }

    @ViewBuilder
    var body: some View {
        switch route {
        case .boot:
            BootView()
                .onAppear(perform: scheduleBootEnd)
        case .onboarding:
            OnboardingView()
        case .login:
            LoginView()
        case .main:
            MainTabView()
        }
    }

    /// Termina el boot rápidamente — 0.6s. Antes era 1.8s, lo que se
    /// sentía como "delay artificial" al usuario. 0.6s alcanza para que
    /// el splash registre como intencional sin frenar al usuario que
    /// ya está esperando para usar la app.
    ///
    /// Si auth todavía está en `.loading` cuando termina este timer,
    /// el `route` computed sigue devolviendo `.boot` automáticamente
    /// hasta que `auth.state` resuelva — no perdemos el placeholder.
    private func scheduleBootEnd() {
        guard isBooting else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            isBooting = false
        }
    }
}
