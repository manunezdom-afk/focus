import SwiftUI

@main
struct FocusApp: App {
    @StateObject private var dataStore = FocusDataStore()
    @StateObject private var authStore = AuthStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
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
