import SwiftUI

struct ContentView: View {
    @State private var isBooting = true

    var body: some View {
        ZStack {
            if isBooting {
                BootView()
                    .transition(.opacity)
                    .zIndex(1)
            } else {
                HomeView()
                    .transition(.opacity)
                    .zIndex(0)
            }
        }
        .animation(.easeOut(duration: 0.4), value: isBooting)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                isBooting = false
            }
        }
    }
}
