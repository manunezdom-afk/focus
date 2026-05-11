import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var auth: AuthStore
    @AppStorage("focus.v1.hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var isBooting = true

    var body: some View {
        ZStack {
            if isBooting {
                BootView()
                    .transition(.opacity)
                    .zIndex(2)
            } else {
                routedContent
                    .transition(.opacity)
                    .zIndex(0)
            }
        }
        .animation(.easeOut(duration: 0.4), value: isBooting)
        .animation(.easeOut(duration: 0.25), value: hasSeenOnboarding)
        .animation(.easeOut(duration: 0.25), value: auth.isAuthenticatedOrDemo)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                isBooting = false
            }
        }
    }

    @ViewBuilder
    private var routedContent: some View {
        if !hasSeenOnboarding {
            OnboardingView()
        } else if case .loading = auth.state {
            // Refresh-token en curso (o init aún resolviendo): seguir
            // mostrando BootView para no parpadear Login.
            BootView()
        } else if auth.isAuthenticatedOrDemo {
            MainTabView()
        } else {
            LoginView()
        }
    }
}
