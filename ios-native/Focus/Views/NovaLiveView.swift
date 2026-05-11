import SwiftUI

/// Nova Live V1.1 — sheet fullscreen para hablarle a Nova con la voz.
///
/// Diseño inspirado en Gemini Live: fondo negro profundo con gradientes
/// violeta/cobalto que respiran lento, esfera de luz central con anillos
/// pulsantes que se expanden, tipografía hairline. La voz se transcribe
/// y se entrega al caller vía `onTranscript`.
struct NovaLiveView: View {
    @StateObject private var service = NovaLiveService()
    @Environment(\.dismiss) private var dismiss

    /// Callback con el texto transcrito final. Solo se dispara cuando hay
    /// texto no vacío. El caller pasa al flujo Nova normal.
    var onTranscript: (String) -> Void

    @State private var ambientPhase: Bool = false
    @State private var didAutoStart: Bool = false

    var body: some View {
        ZStack {
            ambientBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                Spacer(minLength: 0)
                centerVisual
                    .frame(height: 280)
                Spacer(minLength: 0)
                transcriptArea
                    .padding(.horizontal, Theme.Spacing.lg)
                Spacer(minLength: 0)
                primaryActions
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.bottom, Theme.Spacing.xl)
            }
            .padding(.horizontal, Theme.Spacing.xl)
        }
        .preferredColorScheme(.dark)
        .onAppear { ambientPhase = true }
        .task {
            if !didAutoStart {
                didAutoStart = true
                let auth = await service.currentAuthorizationStatus()
                switch auth {
                case .authorized:
                    await service.start()
                case .notDetermined:
                    if await service.requestAuthorization() {
                        await service.start()
                    }
                case .denied:
                    if service.state == .idle {
                        _ = await service.requestAuthorization()
                    }
                }
            }
        }
        .onDisappear { service.cancel() }
    }

    // MARK: - Ambient background (gradientes vivos que respiran)

    private var ambientBackground: some View {
        ZStack {
            // Base casi negro con tinte azul muy sutil para no ser plano.
            Color(red: 0.02, green: 0.03, blue: 0.08)

            // Halo violeta — se mueve de arriba a abajo lentamente.
            RadialGradient(
                colors: [Theme.Colors.novaAccent.opacity(0.55), .clear],
                center: ambientPhase
                    ? UnitPoint(x: 0.65, y: 0.18)
                    : UnitPoint(x: 0.35, y: 0.42),
                startRadius: 30,
                endRadius: 420
            )
            .blendMode(.plusLighter)
            .opacity(0.85)
            .animation(.easeInOut(duration: 7).repeatForever(autoreverses: true), value: ambientPhase)

            // Halo cobalto — se mueve cruzado al violeta.
            RadialGradient(
                colors: [Theme.Colors.focusAccent.opacity(0.42), .clear],
                center: ambientPhase
                    ? UnitPoint(x: 0.30, y: 0.78)
                    : UnitPoint(x: 0.70, y: 0.52),
                startRadius: 60,
                endRadius: 380
            )
            .blendMode(.plusLighter)
            .opacity(0.70)
            .animation(.easeInOut(duration: 9).repeatForever(autoreverses: true), value: ambientPhase)

            // Vignette oscuro en los bordes para profundidad.
            RadialGradient(
                colors: [.clear, Color.black.opacity(0.55)],
                center: .center,
                startRadius: 250,
                endRadius: 580
            )
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            glassCircleButton(symbol: "xmark") {
                HapticManager.shared.tick()
                service.cancel()
                dismiss()
            }
            Spacer()
            VStack(spacing: 2) {
                Text("Nova Live")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))
                    .tracking(1.2)
                stateBadge
            }
            Spacer()
            Color.clear.frame(width: 40, height: 40)
        }
        .padding(.top, Theme.Spacing.md)
    }

    private var stateBadge: some View {
        let (label, color): (String, Color) = {
            switch service.state {
            case .idle:
                return (service.transcript.isEmpty ? "preparando" : "listo", .white.opacity(0.55))
            case .requestingPermissions:
                return ("permisos", .white.opacity(0.55))
            case .listening:
                return ("escuchando", Theme.Colors.novaAccent)
            case .processing:
                return ("procesando", Theme.Colors.focusAccent)
            case .denied:
                return ("sin permiso", Color(red: 1.00, green: 0.55, blue: 0.40))
            case .error:
                return ("error", Color(red: 1.00, green: 0.55, blue: 0.40))
            }
        }()
        return HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 5, height: 5)
                .shadow(color: color.opacity(0.8), radius: 4)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(color)
                .tracking(0.8)
                .textCase(.uppercase)
        }
    }

    // MARK: - Visual central (rings + core)

    private var centerVisual: some View {
        let isListening = service.state == .listening
        return ZStack {
            // Tres anillos staggered cuando está escuchando — efecto ripple.
            PulseRing(active: isListening, color: Theme.Colors.novaAccent.opacity(0.55), delay: 0.0)
            PulseRing(active: isListening, color: Theme.Colors.focusAccent.opacity(0.50), delay: 0.85)
            PulseRing(active: isListening, color: Theme.Colors.novaAccent.opacity(0.40), delay: 1.70)

            // Halo difuso detrás del core — siempre visible, pulsa lento.
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Theme.Colors.novaAccent.opacity(0.65),
                            Theme.Colors.novaAccent.opacity(0.0)
                        ],
                        center: .center,
                        startRadius: 20,
                        endRadius: 140
                    )
                )
                .frame(width: 240, height: 240)
                .scaleEffect(ambientPhase ? 1.08 : 0.94)
                .animation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true), value: ambientPhase)

            // Core sólido — esfera con gradient + glow.
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.white.opacity(0.95),
                                Theme.Colors.novaAccent.opacity(0.90),
                                Theme.Colors.focusAccent.opacity(0.85)
                            ],
                            center: UnitPoint(x: 0.38, y: 0.32),
                            startRadius: 6,
                            endRadius: 90
                        )
                    )
                    .frame(width: 130, height: 130)
                    .shadow(color: Theme.Colors.novaAccent.opacity(0.85), radius: 35, y: 12)
                    .shadow(color: Theme.Colors.focusAccent.opacity(0.45), radius: 60, y: 0)

                // Inner highlight (specular)
                Circle()
                    .fill(.white.opacity(0.40))
                    .frame(width: 50, height: 50)
                    .blur(radius: 18)
                    .offset(x: -18, y: -22)

                NovaSparkMark(size: 56)
                    .shadow(color: .white.opacity(0.6), radius: 8)
            }
            .scaleEffect(isListening && ambientPhase ? 1.05 : 1.0)
            .animation(
                isListening
                    ? .easeInOut(duration: 1.4).repeatForever(autoreverses: true)
                    : .easeInOut(duration: 0.4),
                value: ambientPhase
            )
        }
    }

    // MARK: - Transcript + headline

    private var transcriptArea: some View {
        VStack(spacing: Theme.Spacing.md) {
            Text(stateHeadline)
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .frame(maxWidth: 340)
                .animation(.easeInOut(duration: 0.25), value: stateHeadline)

            if !service.transcript.isEmpty {
                Text(service.transcript)
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(.white.opacity(0.92))
                    .multilineTextAlignment(.center)
                    .lineLimit(5)
                    .truncationMode(.head)
                    .padding(.horizontal, Theme.Spacing.md + 2)
                    .padding(.vertical, Theme.Spacing.sm + 2)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(.ultraThinMaterial)
                            .overlay(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .strokeBorder(.white.opacity(0.10), lineWidth: 1)
                            )
                    )
                    .padding(.horizontal, Theme.Spacing.md)
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
            } else if !stateSubtitle.isEmpty {
                Text(stateSubtitle)
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(.white.opacity(0.55))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
                    .lineSpacing(2)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: service.transcript.isEmpty)
    }

    // MARK: - Actions

    @ViewBuilder
    private var primaryActions: some View {
        switch service.state {
        case .listening:
            HStack(spacing: Theme.Spacing.md) {
                ghostButton(label: "Cancelar") {
                    service.cancel()
                    dismiss()
                }
                primaryButton(label: "Detener", icon: "stop.fill") {
                    service.stop()
                }
            }
        case .processing:
            HStack {
                Spacer()
                ProgressView().tint(.white).scaleEffect(1.15)
                Spacer()
            }
            .frame(height: 52)
        case .idle:
            if !service.transcript.isEmpty {
                HStack(spacing: Theme.Spacing.md) {
                    ghostButton(label: "Reintentar") {
                        service.cancel()
                        Task { await service.start() }
                    }
                    primaryButton(label: "Enviar", icon: "arrow.up") {
                        deliverTranscript()
                    }
                }
            } else {
                primaryButton(label: "Empezar a hablar", icon: "mic.fill") {
                    Task { await service.start() }
                }
            }
        case .requestingPermissions:
            primaryButton(label: "Esperando permiso…", icon: "hourglass") {}
                .disabled(true)
                .opacity(0.55)
        case .denied:
            VStack(spacing: Theme.Spacing.sm + 2) {
                primaryButton(label: "Abrir Ajustes del iPhone", icon: "gear") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                ghostButton(label: "Cerrar") { dismiss() }
            }
        case .error(let msg):
            VStack(spacing: Theme.Spacing.sm + 2) {
                Text(msg)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(.white.opacity(0.70))
                    .multilineTextAlignment(.center)
                HStack(spacing: Theme.Spacing.md) {
                    ghostButton(label: "Cerrar") { dismiss() }
                    primaryButton(label: "Reintentar", icon: "arrow.clockwise") {
                        Task { await service.start() }
                    }
                }
            }
        }
    }

    // MARK: - Buttons

    private func primaryButton(label: String, icon: String, action: @escaping () -> Void) -> some View {
        Button {
            HapticManager.shared.tap()
            action()
        } label: {
            HStack(spacing: 9) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .bold))
                Text(label)
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                Theme.Colors.focusAccent,
                                Theme.Colors.novaAccent
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .overlay(
                        Capsule()
                            .strokeBorder(.white.opacity(0.20), lineWidth: 1)
                    )
                    .shadow(color: Theme.Colors.novaAccent.opacity(0.55), radius: 22, y: 8)
                    .shadow(color: Theme.Colors.focusAccent.opacity(0.30), radius: 12, y: 4)
            )
        }
        .buttonStyle(.plain)
    }

    private func ghostButton(label: String, action: @escaping () -> Void) -> some View {
        Button {
            HapticManager.shared.tick()
            action()
        } label: {
            Text(label)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(.white.opacity(0.85))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    Capsule()
                        .fill(.ultraThinMaterial)
                        .overlay(
                            Capsule()
                                .strokeBorder(.white.opacity(0.16), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
    }

    private func glassCircleButton(symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.90))
                .frame(width: 40, height: 40)
                .background(
                    Circle()
                        .fill(.ultraThinMaterial)
                        .overlay(
                            Circle()
                                .strokeBorder(.white.opacity(0.18), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
    }

    private func deliverTranscript() {
        let text = service.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        onTranscript(text)
        dismiss()
    }

    // MARK: - Copy contextual

    private var stateHeadline: String {
        switch service.state {
        case .idle:
            return service.transcript.isEmpty
                ? "Toca para empezar"
                : "Listo, ¿lo envío a Nova?"
        case .requestingPermissions:
            return "Pidiendo permisos…"
        case .listening:
            return "Estoy escuchando"
        case .processing:
            return "Procesando…"
        case .denied:
            return "Necesito permiso"
        case .error:
            return "Hubo un problema"
        }
    }

    private var stateSubtitle: String {
        switch service.state {
        case .idle:
            return service.transcript.isEmpty
                ? "Dime qué quieres ordenar."
                : "Toca «Enviar» o vuelve a intentar."
        case .requestingPermissions:
            return "Acepta el acceso al micrófono y voz."
        case .listening:
            return "Habla con tranquilidad. Cuando termines, toca Detener."
        case .processing:
            return "Estoy transcribiendo lo último."
        case .denied:
            return "Activa el micrófono y voz en Ajustes del iPhone para usar Nova Live."
        case .error:
            return ""
        }
    }
}

// MARK: - PulseRing

/// Anillo que se expande desde el centro y se desvanece, en loop infinito.
/// Tres de estos staggered con `delay` distinto dan el efecto ripple
/// continuo de Nova escuchando.
private struct PulseRing: View {
    let active: Bool
    let color: Color
    let delay: Double

    @State private var expand: Bool = false

    var body: some View {
        Circle()
            .strokeBorder(color, lineWidth: 1.6)
            .frame(width: 130, height: 130)
            .scaleEffect(expand ? 2.3 : 0.85)
            .opacity(active ? (expand ? 0.0 : 0.85) : 0)
            .animation(
                active
                    ? .easeOut(duration: 2.6)
                        .repeatForever(autoreverses: false)
                        .delay(delay)
                    : .easeOut(duration: 0.3),
                value: expand
            )
            .onChange(of: active) { _, isActive in
                // Reset y arrancar cuando se activa.
                if isActive {
                    expand = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                        expand = true
                    }
                } else {
                    expand = false
                }
            }
            .onAppear {
                if active {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                        expand = true
                    }
                }
            }
    }
}
