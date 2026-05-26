import SwiftUI

/// Splash cinematic. Gradiente radial premium + logo grande con glow + wordmark
/// debajo + tagline. Primera impresión del producto.
///
/// v7 fix microcorte: el BootView termina haciendo un FADE del gradient
/// deep navy hacia el canvas light de la app (Theme.Colors.background).
/// Antes el Boot quedaba en deep cobalto hasta el último frame y la
/// transición al MainTab (canvas light) creaba un flash gris/blanco
/// muy notorio. Ahora el último 0.2s del Boot revela el canvas light
/// debajo del gradient deep, así cuando MainTab fade-in, ambos están
/// sobre el mismo color base → cero salto visual.
struct BootView: View {
    @State private var opacity: Double = 0.0
    @State private var markScale: CGFloat = 0.88
    @State private var glowOpacity: Double = 0.0
    /// Cuando true → el gradient deep + logo + wordmark hacen fade-out a 0
    /// y queda visible el canvas light. Se activa antes del final del
    /// Boot para morph a la paleta del MainTab.
    @State private var morphToLight: Bool = false
    /// Opacity del gradiente radial. Arranca en 0 (solo cobalto plano,
    /// matching el LaunchScreen iOS) y hace fade-in a 1 en los primeros
    /// 300ms. Sin este fade-in, el primer frame del BootView mostraba
    /// el radial al 100% inmediatamente → salto visible desde el cobalto
    /// plano del LaunchScreen (#1E2D6B) al gradient deep navy/indigo
    /// (centro #25388A, bordes #0F0A29). Microrotura confirmada con
    /// captura de video del launch (2026-05-26).
    @State private var radialOpacity: Double = 0.0

    /// Color cobalto EXACTO del LaunchScreen iOS — debe matchear
    /// LaunchBackground asset (#1E2D6B = rgb 0.118/0.176/0.420). Esta
    /// capa es la base sobre la que aparece el radial, garantizando
    /// continuidad cromática desde el primer paint del BootView.
    private static let launchCobalt = Color(red: 0.118, green: 0.176, blue: 0.420)

    /// Gradiente radial multi-stop: brillante cobalto en el centro,
    /// navy profundo intermedio, tinte indigo/violeta en los bordes.
    /// Da sensación de "spotlight" sobre el logo.
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
            // v7: capa light DEBAJO de todo. Cuando morphToLight se activa,
            // las capas oscuras hacen fade-out y revelan este canvas —
            // coincide exactamente con `Theme.Colors.background` del MainTab
            // → la transición Boot → MainTab no salta de color.
            Theme.Colors.background
                .ignoresSafeArea()

            // v8 fix microrotura: capa cobalto plano matching el
            // LaunchScreen iOS. Visible desde el primer paint del BootView
            // — sin esta capa, el primer frame mostraba directo el radial
            // gradient y se notaba un salto desde el cobalto plano del
            // launch al radial deep navy. Hace fade-out junto con el radial
            // cuando morphToLight = true para revelar el canvas light.
            Self.launchCobalt
                .ignoresSafeArea()
                .opacity(morphToLight ? 0 : 1)

            // v8: el radial ahora arranca en opacity 0 y hace fade-in a 1
            // en los primeros 300ms. Eso convierte la aparición del
            // gradient en una "iluminación cinematográfica" sobre el
            // cobalto plano (matching launch), en vez del salto abrupto
            // que existía antes.
            bgRadial
                .ignoresSafeArea()
                .opacity(radialOpacity * (morphToLight ? 0 : 1))

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
            // v7: TODO el contenido (logo + wordmark) fade-out junto con
            // el gradient cuando morphToLight = true. Solo queda visible
            // el canvas light, matching el MainTab.
            .opacity(morphToLight ? 0 : 1)
        }
        .onAppear {
            // v8: fade-in del radial sobre el cobalto plano del launch.
            // 300ms es suficiente para que la "iluminación" del gradient
            // se perciba sin sentirse lenta — combina con el fade-in del
            // wordmark y del glow.
            withAnimation(.easeOut(duration: 0.30)) {
                radialOpacity = 1
            }
            // Fade-in inicial — el splash se asienta.
            withAnimation(.easeOut(duration: 0.35)) {
                opacity = 1
                markScale = 1.0
            }
            withAnimation(.easeOut(duration: 0.45).delay(0.05)) {
                glowOpacity = 1
            }

            // v7 morph: a los 400ms (de los 600ms totales del Boot) empieza
            // a fade del gradient deep al canvas light. Cuando ContentView
            // hace switch a .main a los 600ms, ya estamos sobre canvas
            // matching → MainTab fade-in sin salto de color.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.40) {
                withAnimation(.easeInOut(duration: 0.20)) {
                    morphToLight = true
                }
            }
        }
    }
}

#Preview {
    BootView()
}
