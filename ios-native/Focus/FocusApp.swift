import SwiftUI

@main
struct FocusApp: App {
    @StateObject private var store = FocusDataStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(.light)
                .tint(Theme.Colors.focusAccent)
        }
    }
}
