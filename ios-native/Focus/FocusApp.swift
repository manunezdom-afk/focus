import SwiftUI

@main
struct FocusApp: App {
    @StateObject private var dataStore = FocusDataStore()
    @StateObject private var authStore = AuthStore()
    @StateObject private var coachMarks = CoachMarksStore()

    init() {
        #if DEBUG
        // Test runner gate: `FOCUS_RUN_TESTS=1` env var (preferido —
        // `SIMCTL_CHILD_FOCUS_RUN_TESTS=1` desde el host) o argumento
        // `--run-nova-tests` en argv. Algunas combinaciones de simulador/
        // versión de iOS no propagan SIMCTL_CHILD_* a `ProcessInfo`, así
        // que aceptamos ambas formas.
        let envFlag = ProcessInfo.processInfo.environment["FOCUS_RUN_TESTS"] == "1"
        let argFlag = CommandLine.arguments.contains("--run-nova-tests")
        if envFlag || argFlag {
            // Marker file ANTES de runAll() para que sepamos que init() entró
            // a esta rama. Si runAll() crashea, este file queda como evidencia.
            if let docs = FileManager.default.urls(
                for: .documentDirectory, in: .userDomainMask
            ).first {
                let marker = docs.appendingPathComponent("focus-tests-started.log")
                try? "init reached test branch at \(Date())".write(
                    to: marker, atomically: true, encoding: .utf8
                )
            }

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
                // Overlay global de coach marks — se monta acá para que
                // ningún sheet/tab interfiera con el zIndex. La card aparece
                // cuando `coachMarks.presenting != nil`.
                CoachMarkOverlay(store: coachMarks)
            }
            .environmentObject(dataStore)
            .environmentObject(authStore)
            .environmentObject(coachMarks)
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
            // QA harness deep-link — DEBUG only. Permite ejecutar inputs
            // contra el pipeline real Nova (sendNovaMessage → backend →
            // store → UI) sin depender de typing en el simulator.
            // Uso:
            //   xcrun simctl openurl booted "focusqa://send?text=hola&reqId=q1"
            // En Release builds, este bloque NO compila → el URL llega
            // pero el handler no existe → app ignora.
            .onOpenURL { url in
                #if DEBUG
                handleQAURL(url)
                #endif
            }
        }
    }

    #if DEBUG
    /// Parsea `focusqa://send?text=...&reqId=...` y llama al MISMO punto
    /// de entrada que la UI (`dataStore.sendNovaMessage`). El backend ve
    /// el reqId via header X-Request-Id (lo arma NovaService internamente
    /// — no exponemos el reqId del query directamente al server porque
    /// el endpoint tiene su propia generación, pero loggeamos local para
    /// correlacionar con los logs Vercel via tiempo + contenido).
    ///
    /// Si la sesión es demo, igual procesa — `sendNovaMessage` no
    /// chequea estado de auth, solo necesita texto válido.
    private func handleQAURL(_ url: URL) {
        guard url.scheme == "focusqa" else { return }
        guard let comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        let text = comps.queryItems?.first(where: { $0.name == "text" })?.value ?? ""
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            print("[QA-harness] URL recibida sin texto: \(url)")
            return
        }
        let reqId = comps.queryItems?.first(where: { $0.name == "reqId" })?.value ?? UUID().uuidString
        print("[QA-harness] reqId=\(reqId) text=\(trimmed.prefix(80))")
        // Despachamos al main para alinear con la UI que normalmente
        // dispara este flow desde un tap del usuario.
        DispatchQueue.main.async {
            dataStore.sendNovaMessage(trimmed)
        }
    }
    #endif

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
