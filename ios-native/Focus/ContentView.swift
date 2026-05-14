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

    var body: some View {
        // 2026-05-13: transición suave entre pantallas root.
        // Antes el switch hacía swap atómico instantáneo — al pasar de
        // login → main se sentía "brusco" (el usuario lo reportó: "no es
        // como en otras apps que es más tranquilo y visualmente agradable,
        // acá salta de una pantalla a otra"). Ahora cada pantalla tiene
        // su `.transition()` y el outer ZStack anima `value: route` —
        // una sola animación sobre un único valor evita el bug histórico
        // de capas duplicadas (que ocurría con 3 `.animation(value:)`
        // separados disparando crossfades simultáneos). El crossfade es
        // opacity 0.45s + scale sutil 0.98→1.0 al entrar en MainTabView,
        // que da la sensación de "asentar" en la app sin chocar.
        ZStack {
            if route == .boot {
                BootView()
                    .onAppear(perform: scheduleBootEnd)
                    .transition(.opacity)
            }
            if route == .onboarding {
                OnboardingView()
                    .transition(.opacity)
            }
            if route == .login {
                LoginView()
                    .transition(.opacity)
            }
            if route == .main {
                MainTabView()
                    .transition(
                        .asymmetric(
                            // Al entrar: opacity + escala muy sutil hacia 1.0.
                            // Da feeling de "se asienta" sin que parezca rebote.
                            insertion: .opacity.combined(with: .scale(scale: 0.985)),
                            // Al salir (logout): solo opacity, sin escala —
                            // no queremos animar "out" agresivamente cuando
                            // el usuario cierra sesión, debe ser limpio.
                            removal: .opacity
                        )
                    )
            }
        }
        .animation(.easeInOut(duration: 0.45), value: route)
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
