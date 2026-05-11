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
        }
    }
}
