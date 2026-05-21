import SwiftUI

/// Sheet compacto para dictar texto rápido. NO es Nova Live — es la
/// experiencia "dictar para escribir" del micrófono del FocusBar y del
/// input del chat. Visual sobrio, claro, alineado con el resto de la app.
///
/// Flujo:
/// 1. Al aparecer pide permisos si faltan y arranca a escuchar.
/// 2. Usuario habla → transcripción en vivo.
/// 3. Watchdog de silencio (en NovaLiveService) o usuario toca "Listo".
/// 4. `onTranscript(text)` se llama y dismiss.
///
/// El caller decide qué hacer con el texto:
/// - Mi Día → procesa el texto inline (`processNovaInline`).
/// - Chat → carga el texto en el draft del input (el usuario revisa y
///   envía cuando quiera).
struct VoiceDictationSheet: View {
    @StateObject private var service = NovaLiveService()
    @Environment(\.dismiss) private var dismiss

    var onTranscript: (String) -> Void

    @State private var didAutoStart: Bool = false
    @State private var pulse: Bool = false

    /// Mapea el state del NovaLiveService al state del visualizer
    /// unificado de la app — para que el ambient canvas + las barras
    /// gradient sepan qué cara mostrar.
    private var visualizerState: FocusAudioVisualizerState {
        switch service.state {
        case .listening:
            return service.audioLevel > 0.08 ? .speaking : .listening
        case .processing:
            return .processing
        default:
            return .idle
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Theme 2.0: header indicator con NovaSparkMark mini (marca Nova,
            // no mic genérico) + captionMono UPPERCASE. Comunica que la voz
            // está conectada al asistente Nova, no a un dictado neutral.
            HStack(spacing: 6) {
                NovaSparkMark(size: 10, fillColor: AnyShapeStyle(Theme.Colors.novaAccent))
                Text("Dictado")
                    .font(Theme.Typography.captionMono)
                    .tracking(Theme.Tracking.captionMono)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .textCase(.uppercase)
            }
            .padding(.top, Theme.Spacing.md + 4)
            .padding(.bottom, Theme.Spacing.lg)

            visual

            // Theme 2.0 v4: banda de visualizer reactivo unificado entre el
            // NovaVoiceCore + WaveformRing y la transcripción. Las barras
            // gradient cobalto→violet reaccionan al audio level — coherente
            // con la banda que aparece bajo el FocusBar inline. Toda la
            // app comparte el mismo lenguaje visual de voz.
            FocusAudioVisualizer(
                level: service.audioLevel,
                state: visualizerState,
                maxBarHeight: 56
            )
            .frame(height: 56)
            .padding(.horizontal, Theme.Spacing.xxl)
            .padding(.top, Theme.Spacing.lg)

            transcriptText
                .frame(maxWidth: .infinity)
                .padding(.horizontal, Theme.Spacing.xl)
                .padding(.top, Theme.Spacing.md)

            Spacer(minLength: Theme.Spacing.lg)

            actions
                .padding(.horizontal, Theme.Spacing.xl)
                .padding(.bottom, Theme.Spacing.xl)
        }
        .frame(maxWidth: .infinity)
        .background(
            // Theme 2.0 v4: ambient canvas atrás del sheet también — la
            // sensación "presencia Nova" se mantiene cuando se abre.
            FocusAmbientCanvas(state: visualizerState == .speaking ? .listening : .idle)
        )
        .onAppear { pulse = true }
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

    // MARK: - Visual (Theme 2.0 — NovaVoiceCore + WaveformRing)
    //
    // Antes: halo cobalto + mic.fill icon — inconsistente con la marca Nova
    // (violet) y plano visualmente. El sheet se sentía como "otro mic",
    // no como "estás hablando con Nova".
    //
    // Ahora:
    // - NovaVoiceCore: squircle 84×84 con gradient NovaPrism + glow violet.
    //   El glyph central es el NovaSparkMark blanco (mismo de la app entera).
    // - WaveformRing: 3 anillos concéntricos hairline 0.5pt color novaAccent
    //   con opacity 0.10 / 0.25 / 0.50 escalando con el audio level real.
    // - Sin pulse infinito: la respiración la dicta el audio. Cuando hay
    //   silencio absoluto, los anillos descansan en escala base.

    private var visual: some View {
        let isListening = service.state == .listening
        let level: CGFloat = isListening
            ? max(0, min(1, CGFloat(service.audioLevel)))
            : 0
        return ZStack {
            // 3 anillos concéntricos — Theme 2.0 FASE 2: opacity MUCHO más
            // alta (0.85/0.55/0.30 vs 0.50/0.25/0.10 anterior) y lineWidth
            // 1.0pt (vs 0.5pt) para que se vean siempre, no solo al hablar.
            // El idle baseline opacity también sube de 35% a 70% — el core
            // se siente "vivo" desde el momento que abre el sheet.
            ForEach(0..<3, id: \.self) { i in
                let baseSize: CGFloat = 110 + CGFloat(i) * 28
                let ringOpacity: Double = [0.85, 0.55, 0.30][i]
                let scaleBoost: CGFloat = level * 0.20 * CGFloat(3 - i)
                Circle()
                    .strokeBorder(
                        Theme.Colors.novaAccent.opacity(ringOpacity),
                        lineWidth: 1.0
                    )
                    .frame(width: baseSize, height: baseSize)
                    .scaleEffect(1.0 + scaleBoost)
                    .opacity(isListening ? 1.0 : 0.70)
                    .animation(Theme.Spring.interactive, value: level)
                    .animation(Theme.Motion.easeInOutStandard, value: isListening)
            }

            // NovaVoiceCore — squircle 84×84 con gradient NovaPrism. Theme 2.0
            // FASE 2: glow base mucho más fuerte (45% vs 25% idle, 75% vs
            // 55% listening) para que el squircle "irradie" desde que se
            // abre el sheet.
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(Theme.Colors.novaPrismGradient)
                .frame(width: 84, height: 84)
                .overlay(
                    // Inner highlight specular top-left para sensación 3D.
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .stroke(Color.white.opacity(0.30), lineWidth: 0.9)
                )
                .shadow(
                    color: Theme.Colors.novaAccent.opacity(isListening ? 0.75 : 0.45),
                    radius: isListening ? 30 : 22,
                    x: 0,
                    y: 8
                )
                .scaleEffect(1.0 + level * 0.10)
                .animation(Theme.Spring.interactive, value: level)
                .animation(Theme.Motion.easeInOutStandard, value: isListening)

            // NovaSparkMark blanco en el centro — marca propia de Nova.
            NovaSparkMark(size: 36, fillColor: AnyShapeStyle(Color.white))
                .scaleEffect(1.0 + level * 0.05)
                .animation(Theme.Spring.interactive, value: level)
        }
        .frame(height: 180)
        // Theme 2.0: ofloading al GPU. Renderizar 3 anillos + core + spark
        // con gradients + shadows en cada frame del audio level es costoso
        // en CPU. drawingGroup mueve el composite a Metal — 60fps estables.
        .drawingGroup()
    }

    // MARK: - Transcript / state text

    @ViewBuilder
    private var transcriptText: some View {
        switch service.state {
        case .idle:
            if service.transcript.isEmpty {
                Text("Toca el micrófono para empezar.")
                    .font(Theme.Typography.subhead)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .multilineTextAlignment(.center)
            } else {
                transcriptBubble
            }
        case .listening:
            VStack(spacing: Theme.Spacing.xs) {
                // Theme 2.0: label "ESCUCHANDO…" en captionMono UPPERCASE
                // con tinte Nova (no focusAccent) — voz pertenece a la marca
                // Nova en Theme 2.0.
                Text("Escuchando…")
                    .font(Theme.Typography.captionMono)
                    .tracking(Theme.Tracking.captionMono)
                    .foregroundStyle(Theme.Colors.novaAccent)
                    .textCase(.uppercase)
                if !service.transcript.isEmpty {
                    transcriptBubble
                        .padding(.top, Theme.Spacing.xs)
                }
            }
        case .processing:
            VStack(spacing: Theme.Spacing.xs) {
                ProgressView().tint(Theme.Colors.focusAccent)
                Text("Procesando…")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
        case .requestingPermissions:
            Text("Pidiendo permisos…")
                .font(Theme.Typography.subhead)
                .foregroundStyle(Theme.Colors.textTertiary)
                .multilineTextAlignment(.center)
        case .denied:
            Text("Activa el micrófono y voz en Ajustes del iPhone para dictar.")
                .font(Theme.Typography.subhead)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        case .error(let msg):
            Text(msg)
                .font(Theme.Typography.subhead)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var transcriptBubble: some View {
        Text(service.transcript)
            // Theme 2.0: headline 17pt SemiBold con tracking opinado para
            // que la transcripción se sienta "display" — el usuario lee
            // poco texto pero importante (lo que está dictando).
            .font(Theme.Typography.headline)
            .tracking(Theme.Tracking.headline)
            .foregroundStyle(Theme.Colors.textPrimary)
            .multilineTextAlignment(.center)
            .lineLimit(4)
            .truncationMode(.head)
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.sm + 2)
            .frame(maxWidth: .infinity)
            // surfaceL2 + borderHairline = card sutil Z-1 sin pelearse con
            // el NovaVoiceCore visualmente.
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                    .fill(Theme.Colors.surfaceL2)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                            .strokeBorder(Theme.Colors.borderHairline, lineWidth: Theme.Stroke.hairline)
                    )
            )
    }

    // MARK: - Actions

    @ViewBuilder
    private var actions: some View {
        switch service.state {
        case .listening:
            HStack(spacing: Theme.Spacing.md) {
                ghostButton(label: "Cancelar") {
                    service.cancel()
                    dismiss()
                }
                primaryButton(label: "Listo", icon: "checkmark") {
                    service.stop()
                }
            }
        case .processing:
            // No mostramos botones, el spinner hace el trabajo.
            EmptyView()
                .frame(height: 50)
        case .idle:
            if service.transcript.isEmpty {
                primaryButton(label: "Empezar", icon: "mic.fill") {
                    Task { await service.start() }
                }
            } else {
                HStack(spacing: Theme.Spacing.md) {
                    ghostButton(label: "Reintentar") {
                        service.cancel()
                        Task { await service.start() }
                    }
                    primaryButton(label: "Enviar", icon: "arrow.up") {
                        deliver()
                    }
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
        case .error:
            HStack(spacing: Theme.Spacing.md) {
                ghostButton(label: "Cerrar") { dismiss() }
                primaryButton(label: "Reintentar", icon: "arrow.clockwise") {
                    Task { await service.start() }
                }
            }
        }
    }

    // Theme 2.0: delegamos a los componentes unificados (FocusPrimaryButton
    // / FocusSecondaryButton de SharedComponents). Antes este sheet definía
    // sus propios primaryButton/ghostButton — ahora la misma anatomía vale
    // para TODA la app. Wrappers cortos para preservar las firmas usadas
    // en el switch de `actions`.

    private func primaryButton(label: String, icon: String, action: @escaping () -> Void) -> some View {
        FocusPrimaryButton(label: label, icon: icon, fullWidth: true, action: action)
    }

    private func ghostButton(label: String, action: @escaping () -> Void) -> some View {
        FocusSecondaryButton(label: label, fullWidth: true, action: action)
    }

    private func deliver() {
        let text = service.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        onTranscript(text)
        dismiss()
    }
}
