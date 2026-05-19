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
        // Transición suave entre pantallas root. Un único `route` computado
        // + un solo `.animation(value:)` evita el bug histórico de crossfades
        // simultáneos (capas duplicadas en pantalla).
        //
        // Pre-warming: MainTabView se mete en el ZStack a opacity/scale 0 en
        // cuanto auth resuelve (aunque el boot todavía esté visible). Así su
        // primer render ocurre silenciosamente en el fondo y no compite con la
        // animación de entrada — elimina el "traba" que se sentía al abrir la app.
        //
        // Curve easeOut (no easeInOut): arranca a velocidad plena y desacelera,
        // lo opuesto al easeInOut que empieza casi estático y se percibe como
        // freeze los primeros frames.
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
            // Pre-warm: entra al árbol (invisible) en cuanto auth resuelve,
            // antes de que el boot termine. Cuando route cambia a .main, el
            // primer frame ya está cacheado → animación sin traba.
            if route == .main || (route == .boot && auth.isAuthenticatedOrDemo) {
                MainTabView()
                    .opacity(route == .main ? 1 : 0)
                    .scaleEffect(route == .main ? 1.0 : 0.985)
                    .allowsHitTesting(route == .main)
                    // Solo aplica en el caso raro donde auth resuelve DESPUÉS
                    // del boot (sin pre-warm): la vista se inserta fresh.
                    .transition(.opacity.combined(with: .scale(scale: 0.985)))
            }
        }
        .animation(.easeOut(duration: 0.35), value: route)
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
