import SwiftUI

@main
struct FocusApp: App {
    @StateObject private var dataStore = FocusDataStore()
    @StateObject private var authStore = AuthStore()

    init() {
        #if DEBUG
        // Si la app se lanza con `FOCUS_RUN_TESTS=1`, corre la suite de
        // tests del normalizer y escribe el resultado a un file en
        // Documents — `print()` no es confiable desde GUI app, pero un
        // file en Documents podemos leerlo desde host via `simctl
        // get_app_container` o lo equivalente en dispositivo físico.
        // No afecta release builds.
        if ProcessInfo.processInfo.environment["FOCUS_RUN_TESTS"] == "1" {
            let result = NovaActionNormalizerTests.runAll()
            print("===== NOVA TESTS =====\n\(result)\n=====================")
            if let docs = FileManager.default.urls(
                for: .documentDirectory, in: .userDomainMask
            ).first {
                let path = docs.appendingPathComponent("focus-tests.log")
                try? result.write(to: path, atomically: true, encoding: .utf8)
            }
        }
        #endif
    }

    var body: some Scene {
        WindowGroup {
            // Background cobalto cuya color matchea EXACTAMENTE el asset
            // LaunchBackground (#1E2D6B = rgb 0.118/0.176/0.420). Sin esto,
            // entre el iOS launch screen y el primer paint del BootView
            // SwiftUI mostraba 1-2 frames de Color.white default → flash
            // blanco. Ahora cualquier vista hija que NO pinte su propio
            // fondo deja ver cobalto, no blanco.
            ZStack {
                Color(red: 0.118, green: 0.176, blue: 0.420)
                    .ignoresSafeArea()
                ContentView()
            }
            .environmentObject(dataStore)
            .environmentObject(authStore)
            .preferredColorScheme(.light)
            .tint(Theme.Colors.focusAccent)
            // Conexión Auth → DataStore para sync Supabase. Cuando
            // cambia el estado de auth (login, refresh, logout, demo),
            // empujamos credenciales al store. Si hay sesión, dispara
            // fetch remoto + habilita upserts en mutaciones.
            .task(id: authChangeId) {
                syncAuthIntoDataStore()
            }
            // Bootstrap notificaciones locales: al arrancar la app,
            // re-asegurar que cada recordatorio futuro tenga su notif
            // programada. iOS no persiste notifs locales al reinstalar
            // ni siempre tras updates, así que esto cubre el gap.
            // Solo dispara una vez por sesión.
            .task {
                dataStore.bootstrapLocalNotifications()
            }
        }
    }

    /// Identidad que cambia cada vez que el `AuthState` produce credenciales
    /// distintas. Sirve como key del `.task(id:)` para re-evaluar.
    private var authChangeId: String {
        switch authStore.state {
        case .loggedIn(let session):
            return "loggedIn:\(session.userId)"
        case .demo:
            return "demo"
        case .loggedOut, .codeSent, .loading:
            return "loggedOut"
        }
    }

    private func syncAuthIntoDataStore() {
        if case .loggedIn(let session) = authStore.state,
           let userId = UUID(uuidString: session.userId) {
            dataStore.applyAuthChange(
                accessToken: session.accessToken,
                userId: userId
            )
        } else {
            dataStore.applyAuthChange(accessToken: nil, userId: nil)
        }
    }
}
