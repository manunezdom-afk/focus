import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var isBooting = true

    var body: some View {
        ZStack {
            if isBooting {
                BootView()
                    .transition(.opacity)
                    .zIndex(1)
            } else {
                routedContent
                    .transition(.opacity)
                    .zIndex(0)
            }
        }
        .animation(.easeOut(duration: 0.4), value: isBooting)
        .animation(.easeOut(duration: 0.25), value: auth.isAuthenticatedOrDemo)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                isBooting = false
            }
        }
    }

    @ViewBuilder
    private var routedContent: some View {
        if auth.isAuthenticatedOrDemo {
            MainTabView()
        } else {
            LoginView()
        }
    }
}
