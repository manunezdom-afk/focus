import SwiftUI

/// Splash cinematic. Gradiente radial premium + logo grande con glow + wordmark
/// debajo + tagline. Primera impresión del producto.
struct BootView: View {
    @State private var opacity: Double = 0.0
    @State private var markScale: CGFloat = 0.88
    @State private var glowOpacity: Double = 0.0

    /// Gradiente radial multi-stop: brillante cobalto en el centro,
    /// navy profundo intermedio, tinte indigo/violeta en los bordes.
    /// Da sensación de "spotlight" sobre el logo, con un guiño violet
    /// que conecta con el gradient interno del Nova diamond.
    private var bgRadial: some View {
        RadialGradient(
            gradient: Gradient(stops: [
                .init(color: Color(red: 0.145, green: 0.220, blue: 0.510), location: 0.00),  // cobalto brillante
                .init(color: Color(red: 0.094, green: 0.135, blue: 0.330), location: 0.45),  // navy intermedio
                .init(color: Color(red: 0.055, green: 0.065, blue: 0.210), location: 0.78),  // muy oscuro
                .init(color: Color(red: 0.060, green: 0.040, blue: 0.160), location: 1.00),  // indigo nocturno
            ]),
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
            // Animaciones acortadas: antes eran 0.8s + 1.2s con delay,
            // pero el BootView ahora vive 0.6s. Comprimimos a 0.35s para
            // que el fade-in alcance a completarse y el splash se sienta
            // intencional, no "frenado".
            withAnimation(.easeOut(duration: 0.35)) {
                opacity = 1
                markScale = 1.0
            }
            withAnimation(.easeOut(duration: 0.45).delay(0.05)) {
                glowOpacity = 1
            }
        }
    }
}

#Preview {
    BootView()
}
