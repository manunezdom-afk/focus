import SwiftUI

/// Sheet premium para dictar a Nova con hold-to-talk + waveform reactiva.
///
/// Diseño:
/// - Botón circular grande con icono micrófono. Hold-to-talk: presionar
///   y mantener activa la captura; soltar la detiene y procesa.
/// - Waveform reactiva al `audioLevel` real (RMS del buffer) de
///   `NovaLiveService`. 7 barras que escalan en altura según el power
///   instantáneo. Es audio level REAL, no simulado.
/// - Estados visuales: idle, listening, processing, success, error,
///   denied (permisos).
/// - Color principal Theme.Colors.focusAccent (cobalto/azul Focus) con
///   acento radial cyan→violeta sutil cuando listening.
/// - Tutorial contextual la primera vez (UserDefaults flag).
///
/// Flujo:
/// 1. Sheet abre en idle.
/// 2. (Primera vez) muestra tutorial sobre hold-to-talk.
/// 3. Usuario hold → `service.start()`.
/// 4. Mientras hold → ondas reactivas + transcript text en vivo.
/// 5. Soltar → `service.stop()` → estado `.processing` por watchdog →
///    `result.isFinal` triggers `.idle` con transcript.
/// 6. `Enviar` toca `onTranscript(text)` con la transcripción FINAL.
/// 7. NO se procesa partial transcript como acción — `onTranscript` solo
///    se llama una vez al final.
///
/// El caller (MiDiaView / NovaView) decide qué hacer con el texto —
/// idéntico flujo que typing, mismo pipeline OpenAI/Nova.

struct VoiceDictationSheet: View {
    @StateObject private var service = NovaLiveService()
    @Environment(\.dismiss) private var dismiss

    var onTranscript: (String) -> Void

    /// Flag UserDefaults para mostrar tutorial solo la primera vez.
    @AppStorage("focus.voice.tutorialSeen.v1") private var tutorialSeen: Bool = false

    @State private var didCheckPermissions: Bool = false
    @State private var showTutorial: Bool = false
    /// True mientras el dedo está presionado sobre el mic (hold-to-talk).
    @State private var isHolding: Bool = false

    var body: some View {
        ZStack {
            content
            if showTutorial {
                tutorialOverlay
                    .transition(.opacity.combined(with: .scale(scale: 0.94)))
            }
        }
        .task {
            // Chequeo inicial de permisos. Si están denied, mostramos el
            // estado correspondiente. Si están notDetermined, los pedimos
            // ANTES del primer hold para que la UI tutoriale.
            if !didCheckPermissions {
                didCheckPermissions = true
                let auth = await service.currentAuthorizationStatus()
                if case .notDetermined = auth {
                    _ = await service.requestAuthorization()
                }
            }
            // Mostrar tutorial la primera vez tras permisos ok.
            if !tutorialSeen {
                showTutorial = true
            }
        }
        .onDisappear { service.cancel() }
    }

    // MARK: - Content layout

    private var content: some View {
        VStack(spacing: 0) {
            header
                .padding(.top, Theme.Spacing.md + 4)
                .padding(.bottom, Theme.Spacing.lg)

            waveform
                .frame(height: 60)
                .padding(.horizontal, Theme.Spacing.xl)
                .padding(.bottom, Theme.Spacing.md)

            micButton
                .padding(.bottom, Theme.Spacing.md)

            stateLabel

            transcriptText
                .frame(maxWidth: .infinity)
                .padding(.horizontal, Theme.Spacing.xl)
                .padding(.top, Theme.Spacing.lg)

            Spacer(minLength: Theme.Spacing.lg)

            actions
                .padding(.horizontal, Theme.Spacing.xl)
                .padding(.bottom, Theme.Spacing.xl)
        }
        .frame(maxWidth: .infinity)
        .background(Theme.Colors.background)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Image(systemName: "mic.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Colors.focusAccent)
            Text("Dictado a Nova")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Colors.textSecondary)
                .tracking(0.8)
                .textCase(.uppercase)
        }
    }

    // MARK: - Waveform reactiva

    /// 7 barras verticales animadas por `service.audioLevel` (RMS real).
    /// Cada barra tiene un offset de fase distinto para que parezcan
    /// onda. Cuando NO está escuchando, las barras quedan en altura
    /// mínima estable.
    private var waveform: some View {
        let isListening = service.state == .listening
        let level = max(0, min(1, CGFloat(service.audioLevel)))
        return HStack(alignment: .center, spacing: 6) {
            ForEach(0..<7, id: \.self) { i in
                // Cada barra usa una variación del nivel para parecer onda.
                let factor: CGFloat = 0.5 + 0.5 * sin(Double(i) * .pi / 3.0)
                let height: CGFloat = isListening
                    ? max(8, 50 * level * factor + 8)
                    : 8
                Capsule()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Theme.Colors.focusAccent,
                                Theme.Colors.focusAccent.opacity(0.6),
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: 6, height: height)
                    .animation(.easeOut(duration: 0.12), value: height)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Mic button con hold-to-talk

    /// Botón central. Usa `DragGesture(minimumDistance: 0)` para detectar
    /// touch-down (`onChanged` con primera invocación) y release
    /// (`onEnded`). LongPressGesture no sirve porque no captura el
    /// release timing — DragGesture sí.
    private var micButton: some View {
        let isListening = service.state == .listening
        let canHold: Bool = {
            switch service.state {
            case .idle, .listening: return true
            default: return false
            }
        }()

        return ZStack {
            // Halo accent — visible cuando hold activo.
            Circle()
                .fill(
                    RadialGradient(
                        gradient: Gradient(colors: [
                            Theme.Colors.focusAccent.opacity(isListening ? 0.28 : 0.10),
                            Theme.Colors.focusAccent.opacity(0.0),
                        ]),
                        center: .center, startRadius: 30, endRadius: 70
                    )
                )
                .frame(width: 140, height: 140)
                .scaleEffect(isListening ? 1.06 : 1.0)
                .animation(
                    isListening
                        ? .easeInOut(duration: 0.9).repeatForever(autoreverses: true)
                        : .easeOut(duration: 0.3),
                    value: isListening
                )

            // Anillo
            Circle()
                .strokeBorder(
                    Theme.Colors.focusAccent.opacity(isListening ? 0.55 : 0.25),
                    lineWidth: 1.5
                )
                .frame(width: 96, height: 96)

            // Cuerpo
            Circle()
                .fill(Theme.Colors.focusAccent.opacity(isListening ? 0.18 : 0.10))
                .frame(width: 84, height: 84)

            Image(systemName: "mic.fill")
                .font(.system(size: 32, weight: .semibold))
                .foregroundStyle(Theme.Colors.focusAccent)
                .scaleEffect(isHolding ? 1.08 : 1.0)
                .animation(.easeOut(duration: 0.15), value: isHolding)
        }
        .contentShape(Circle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    guard canHold else { return }
                    if !isHolding {
                        isHolding = true
                        HapticManager.shared.tick()
                        Task { await service.start() }
                    }
                }
                .onEnded { _ in
                    guard isHolding else { return }
                    isHolding = false
                    HapticManager.shared.tap()
                    // Sólo detener si está escuchando — otros estados se
                    // resuelven solos.
                    if service.state == .listening {
                        service.stop()
                    }
                }
        )
        .accessibilityLabel("Botón de micrófono. Mantén presionado para hablar.")
    }

    // MARK: - State label

    @ViewBuilder
    private var stateLabel: some View {
        switch service.state {
        case .listening:
            Text("Escuchando…")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.focusAccent)
                .tracking(0.6)
                .textCase(.uppercase)
        case .processing:
            HStack(spacing: 6) {
                ProgressView().tint(Theme.Colors.focusAccent).scaleEffect(0.85)
                Text("Procesando…")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .tracking(0.6)
                    .textCase(.uppercase)
            }
        case .idle:
            if service.transcript.isEmpty {
                Text("Mantén presionado el micrófono")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.Colors.textTertiary)
            } else {
                Text("Listo para enviar")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.success)
                    .tracking(0.6)
                    .textCase(.uppercase)
            }
        case .requestingPermissions:
            Text("Pidiendo permisos…")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Colors.textTertiary)
        case .denied:
            Text("Permiso de micrófono requerido")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.warning)
                .tracking(0.6)
                .textCase(.uppercase)
        case .error:
            Text("Algo no funcionó")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.warning)
                .tracking(0.6)
                .textCase(.uppercase)
        }
    }

    // MARK: - Transcript / state text

    @ViewBuilder
    private var transcriptText: some View {
        switch service.state {
        case .idle:
            if !service.transcript.isEmpty {
                transcriptBubble
            }
        case .listening:
            if !service.transcript.isEmpty {
                transcriptBubble
            }
        case .denied:
            Text("Necesito permiso de micrófono para escucharte. Actívalo en Ajustes del iPhone.")
                .font(Theme.Typography.subhead)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        case .error(let msg):
            // Mensaje humano, no técnico.
            Text(humanizeError(msg))
                .font(Theme.Typography.subhead)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        default:
            EmptyView()
        }
    }

    /// Convierte mensajes técnicos a frases humanas. Lista pragmática
    /// de los errores típicos del recognizer; cualquier otra cae al
    /// fallback genérico.
    private func humanizeError(_ raw: String) -> String {
        let lower = raw.lowercased()
        if lower.contains("offline") || lower.contains("network") {
            return "No hay internet. Inténtalo cuando tengas conexión."
        }
        if lower.contains("permission") || lower.contains("permiso") {
            return "Necesito permiso de micrófono para escucharte."
        }
        if lower.contains("silence") || lower.contains("no audio") || lower.contains("silencio") {
            return "No pude escuchar bien. Inténtalo de nuevo o escríbelo."
        }
        if lower.contains("speech") || lower.contains("recognizer") {
            return "Tuve un problema reconociendo tu voz. ¿Lo intentas otra vez?"
        }
        return "No pude escuchar bien. Inténtalo de nuevo o escríbelo."
    }

    private var transcriptBubble: some View {
        Text(service.transcript)
            .font(Theme.Typography.body)
            .foregroundStyle(Theme.Colors.textPrimary)
            .multilineTextAlignment(.center)
            .lineLimit(4)
            .truncationMode(.head)
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.sm)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                    .fill(Theme.Colors.surfaceHigh)
            )
    }

    // MARK: - Actions

    @ViewBuilder
    private var actions: some View {
        switch service.state {
        case .idle:
            if service.transcript.isEmpty {
                ghostButton(label: "Cerrar") { dismiss() }
            } else {
                HStack(spacing: Theme.Spacing.md) {
                    ghostButton(label: "Borrar") { service.cancel() }
                    primaryButton(label: "Enviar", icon: "arrow.up") {
                        deliver()
                    }
                }
            }
        case .listening, .processing:
            // Sin botones — el hold-to-talk maneja todo. El usuario
            // suelta para detener.
            Text("Suelta para enviar")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Colors.textTertiary)
                .frame(height: 50)
        case .requestingPermissions:
            primaryButton(label: "Esperando permiso…", icon: "hourglass") {}
                .disabled(true).opacity(0.55)
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
                    service.cancel()
                }
            }
        }
    }

    // MARK: - Tutorial overlay

    /// Overlay primera vez. Texto del spec del usuario. Botón
    /// "Entendido" cierra y persiste tutorialSeen=true.
    private var tutorialOverlay: some View {
        ZStack {
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture { dismissTutorial() }
            VStack(spacing: Theme.Spacing.md) {
                HStack(spacing: 8) {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.Colors.focusAccent)
                    Text("Hablale a Nova")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.Colors.textPrimary)
                }
                Text("Puedes hablarle a Nova como si fuera texto. Mantén presionado para hablar y suelta para enviar. Puedes corregirte naturalmente, por ejemplo: \"mañana fútbol a las 4, no, mejor a las 5\".")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Button { dismissTutorial() } label: {
                    Text("Entendido")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Capsule().fill(Theme.Colors.focusAccent))
                }
                .buttonStyle(.plain)
            }
            .padding(Theme.Spacing.lg)
            .frame(maxWidth: 320)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(Theme.Colors.background)
                    .shadow(color: .black.opacity(0.18), radius: 20, y: 8)
            )
        }
    }

    private func dismissTutorial() {
        withAnimation(.easeOut(duration: 0.2)) {
            showTutorial = false
            tutorialSeen = true
        }
    }

    // MARK: - Buttons & deliver

    /// Toma el transcript FINAL y lo despacha al pipeline Nova
    /// (typing/voice idéntico). Cierra el sheet inmediatamente — la
    /// confirmación viene desde Mi Día/Nova como con typing.
    private func deliver() {
        let text = service.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        HapticManager.shared.success()
        onTranscript(text)
        service.cancel()
        dismiss()
    }

    private func primaryButton(label: String, icon: String, action: @escaping () -> Void) -> some View {
        Button {
            HapticManager.shared.tap()
            action()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .bold))
                Text(label)
                    .font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Capsule().fill(Theme.Colors.focusAccent))
            .shadow(color: Theme.Colors.focusAccent.opacity(0.35), radius: 14, y: 5)
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
                .foregroundStyle(Theme.Colors.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    Capsule()
                        .fill(Theme.Colors.surfaceHigh)
                        .overlay(
                            Capsule()
                                .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                        )
                )
        }
        .buttonStyle(.plain)
    }
}
