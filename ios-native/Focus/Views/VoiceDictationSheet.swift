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

    var body: some View {
        VStack(spacing: 0) {
            // Mini handle visual del sheet (lo da iOS pero un texto ayuda
            // a comunicar de qué se trata).
            HStack {
                Image(systemName: "mic.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Colors.focusAccent)
                Text("Dictado")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .tracking(0.8)
                    .textCase(.uppercase)
            }
            .padding(.top, Theme.Spacing.md + 4)
            .padding(.bottom, Theme.Spacing.lg)

            visual

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

    // MARK: - Visual

    private var visual: some View {
        let isListening = service.state == .listening
        return ZStack {
            // Halo accent — solo visible cuando escucha.
            Circle()
                .fill(Theme.Colors.focusAccent.opacity(isListening ? 0.16 : 0.08))
                .frame(width: 96, height: 96)
                .scaleEffect(isListening && pulse ? 1.15 : 0.95)
                .animation(
                    isListening
                        ? .easeInOut(duration: 1.0).repeatForever(autoreverses: true)
                        : .easeOut(duration: 0.3),
                    value: pulse
                )

            // Anillo de borde sutil
            Circle()
                .strokeBorder(Theme.Colors.focusAccent.opacity(isListening ? 0.45 : 0.20), lineWidth: 1.5)
                .frame(width: 78, height: 78)

            // Mic icon central
            Image(systemName: "mic.fill")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(Theme.Colors.focusAccent)
                .scaleEffect(isListening && pulse ? 1.05 : 1.0)
                .animation(
                    isListening
                        ? .easeInOut(duration: 0.8).repeatForever(autoreverses: true)
                        : .default,
                    value: pulse
                )
        }
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
                Text("Escuchando…")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.focusAccent)
                    .tracking(0.6)
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

    private func deliver() {
        let text = service.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        onTranscript(text)
        dismiss()
    }
}
