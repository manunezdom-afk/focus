import SwiftUI

/// Splash inicial. Fondo navy profundo + FOCUS wordmark arriba + brand mark centrado.
/// Matchea la identidad visual del AppIcon que ve el usuario en home screen.
struct BootView: View {
    @State private var opacity: Double = 0.0
    @State private var markScale: CGFloat = 0.92

    /// Gradiente vertical navy profundo (más oscuro que el AppIcon — el icon
    /// "brilla" sobre este fondo).
    private let bgGradient = LinearGradient(
        colors: [
            Color(red: 0.039, green: 0.055, blue: 0.165),  // #0A0E2A
            Color(red: 0.102, green: 0.126, blue: 0.314)   // #1A203F
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    var body: some View {
        ZStack {
            bgGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                // FOCUS wordmark arriba (1/8 desde el top)
                FocusWordmark(fontSize: 14, color: .white.opacity(0.85), tracking: 4)
                    .padding(.top, 88)
                    .opacity(opacity)

                Spacer()

                FocusLogoMark(size: 132)
                    .scaleEffect(markScale)
                    .opacity(opacity)

                Spacer()
                Spacer()
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.7)) {
                opacity = 1
                markScale = 1.0
            }
        }
    }
}

#Preview {
    BootView()
}
