import SwiftUI

/// Splash cinematic. Gradiente radial premium + logo grande con glow + wordmark
/// debajo + tagline. Primera impresión del producto.
struct BootView: View {
    @State private var opacity: Double = 0.0
    @State private var markScale: CGFloat = 0.88
    @State private var glowOpacity: Double = 0.0

    /// Gradiente radial: brillante azul en el centro, navy profundo en los bordes.
    /// Da sensación de "spotlight" sobre el logo.
    private var bgRadial: some View {
        RadialGradient(
            colors: [
                Color(red: 0.118, green: 0.176, blue: 0.420),  // brillante centro
                Color(red: 0.039, green: 0.055, blue: 0.165),  // navy profundo bordes
                Color(red: 0.024, green: 0.039, blue: 0.118)   // casi negro en esquinas
            ],
            center: .center,
            startRadius: 80,
            endRadius: 500
        )
    }

    var body: some View {
        ZStack {
            bgRadial.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo con glow halo blanco/azul claro
                ZStack {
                    // Glow halo
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color.white.opacity(0.18),
                                    Color.white.opacity(0.0)
                                ],
                                center: .center,
                                startRadius: 30,
                                endRadius: 220
                            )
                        )
                        .frame(width: 380, height: 380)
                        .opacity(glowOpacity)

                    FocusLogoMark(size: 140)
                        .scaleEffect(markScale)
                }

                Spacer()
                    .frame(height: 36)

                // Wordmark "FOCUS" + tagline
                VStack(spacing: 8) {
                    Text("FOCUS")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(.white)
                        .tracking(5)

                    Text("Mente clara, día ordenado.")
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(.white.opacity(0.55))
                        .tracking(0.3)
                }
                .opacity(opacity)

                Spacer()
                Spacer()
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                opacity = 1
                markScale = 1.0
            }
            withAnimation(.easeOut(duration: 1.2).delay(0.15)) {
                glowOpacity = 1
            }
        }
    }
}

#Preview {
    BootView()
}
