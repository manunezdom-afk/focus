import SwiftUI

/// Nova Live V1 — sheet fullscreen para hablarle a Nova con la voz.
///
/// Diseño: fondo cobalto/violeta con NovaSparkMark grande al centro y
/// pulso animado mientras está escuchando. Estados claros con texto grande
/// y transcripción en vivo. Botones primario (Detener/Confirmar) y
/// secundario (Cancelar).
///
/// Flujo:
/// 1. Al aparecer, pide permisos si faltan.
/// 2. Si autorizado, arranca a escuchar automáticamente.
/// 3. Mientras escucha, muestra `service.transcript` parcial.
/// 4. Usuario toca "Detener" o el watchdog cierra por silencio.
/// 5. Si hay transcripción → `onTranscript(text)` y dismiss.
/// 6. Si no hay transcripción → muestra error amable, opción de reintentar.
///
/// La acción real (crear evento/tarea/recordatorio/notificación) la hace el
/// caller con el flujo de Nova actual (`processNovaInline` o
/// `sendNovaMessage`) — esta view solo entrega el texto.
struct NovaLiveView: View {
    @StateObject private var service = NovaLiveService()
    @Environment(\.dismiss) private var dismiss

    /// Callback con el texto transcrito final. Solo se dispara cuando hay
    /// texto no vacío. El caller pasa al flujo Nova normal.
    var onTranscript: (String) -> Void

    @State private var pulse: Bool = false
    @State private var didAutoStart: Bool = false

    var body: some View {
        ZStack {
            backgroundGradient
                .ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                Spacer()
                centerVisual
                Spacer()
                transcriptArea
                Spacer()
                primaryActions
                    .padding(.bottom, Theme.Spacing.xl)
            }
            .padding(.horizontal, Theme.Spacing.xl)
        }
        .preferredColorScheme(.dark)
        .task {
            // Al abrir, validar permisos y arrancar si está autorizado.
            // Si no, pedir permiso y arrancar tras aceptar.
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
                    // El service ya puso state = .denied via requestAuthorization
                    // si el caller llamara. Acá no llamamos para no spamear el
                    // prompt — el estado denied se muestra solo.
                    // Forzamos el state visible:
                    if service.state == .idle {
                        // Re-leer y actualizar via un request fallido para
                        // que el view muestre la rama denied.
                        _ = await service.requestAuthorization()
                    }
                }
            }
        }
        .onDisappear {
            // Si el usuario cierra el sheet por swipe sin tocar botón,
            // limpiar la sesión.
            service.cancel()
        }
    }

    // MARK: - Background

    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color(red: 0.05, green: 0.10, blue: 0.22),
                Color(red: 0.10, green: 0.05, blue: 0.32),
                Color(red: 0.04, green: 0.04, blue: 0.16)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay(
            // Halo violeta sutil arriba para ambient
            RadialGradient(
                colors: [Theme.Colors.novaAccent.opacity(0.30), .clear],
                center: .top,
                startRadius: 20,
                endRadius: 400
            )
        )
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            Button {
                HapticManager.shared.tick()
                service.cancel()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
                    .frame(width: 36, height: 36)
                    .background(
                        Circle().fill(Color.white.opacity(0.10))
                    )
            }
            .buttonStyle(.plain)
            Spacer()
            Text("Nova Live")
                .font(Theme.Typography.subheadEmphasized)
                .foregroundStyle(.white.opacity(0.80))
                .tracking(0.5)
            Spacer()
            // Spacer simétrico al botón de cerrar.
            Color.clear.frame(width: 36, height: 36)
        }
        .padding(.top, Theme.Spacing.md)
    }

    // MARK: - Visual central (NovaSparkMark + pulso)

    private var centerVisual: some View {
        ZStack {
            // Halo exterior (anillo difuso) — pulsa cuando está escuchando.
            Circle()
                .fill(Theme.Colors.novaAccent.opacity(0.20))
                .frame(width: 220, height: 220)
                .scaleEffect(pulse ? 1.20 : 0.95)
                .opacity(pulse ? 0.7 : 0.35)
                .animation(
                    service.state == .listening
                        ? .easeInOut(duration: 1.30).repeatForever(autoreverses: true)
                        : .default,
                    value: pulse
                )

            // Halo intermedio
            Circle()
                .fill(Theme.Colors.novaGradient)
                .frame(width: 130, height: 130)
                .opacity(0.85)
                .shadow(color: Theme.Colors.novaAccent.opacity(0.55), radius: 28, y: 8)

            // Centro: NovaSparkMark
            NovaSparkMark(size: 50)
        }
        .onAppear { pulse = true }
        .onChange(of: service.state) { _, _ in
            // Re-trigger animación al entrar/salir de listening.
            pulse.toggle()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                pulse.toggle()
            }
        }
    }

    // MARK: - Transcript + estado

    private var transcriptArea: some View {
        VStack(spacing: Theme.Spacing.md) {
            Text(stateHeadline)
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)

            if !service.transcript.isEmpty {
                // lineLimit defensivo: si el usuario habla durante mucho rato
                // el transcript podría empujar los botones fuera de pantalla.
                // 5 líneas alcanza para frases completas + frase de corrección.
                Text(service.transcript)
                    .font(Theme.Typography.body)
                    .foregroundStyle(.white.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .lineLimit(5)
                    .truncationMode(.head)
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.vertical, Theme.Spacing.sm)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                            .fill(.white.opacity(0.08))
                    )
                    .padding(.horizontal, Theme.Spacing.lg)
                    .transition(.opacity)
            } else {
                Text(stateSubtitle)
                    .font(Theme.Typography.subhead)
                    .foregroundStyle(.white.opacity(0.60))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
            }
        }
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
            HStack { Spacer(); ProgressView().tint(.white); Spacer() }
                .frame(height: 48)
        case .idle:
            if !service.transcript.isEmpty {
                // Hay transcripción acumulada y volvimos a idle: dar
                // opción de enviar o reintentar.
                HStack(spacing: Theme.Spacing.md) {
                    ghostButton(label: "Reintentar") {
                        service.cancel()
                        Task { await service.start() }
                    }
                    primaryButton(label: "Enviar a Nova", icon: "arrow.up") {
                        deliverTranscript()
                    }
                }
            } else {
                // Sin transcripción y en idle = aún no arrancó o terminó
                // sin captura.
                primaryButton(label: "Empezar a hablar", icon: "mic.fill") {
                    Task { await service.start() }
                }
            }
        case .requestingPermissions:
            primaryButton(label: "Esperando permiso…", icon: "hourglass") {}
                .disabled(true)
                .opacity(0.6)
        case .denied:
            VStack(spacing: Theme.Spacing.md) {
                primaryButton(label: "Abrir Ajustes del iPhone", icon: "gear") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                ghostButton(label: "Cerrar") {
                    dismiss()
                }
            }
        case .error(let msg):
            VStack(spacing: Theme.Spacing.sm) {
                Text(msg)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(.white.opacity(0.65))
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

    private func primaryButton(label: String, icon: String, action: @escaping () -> Void) -> some View {
        Button {
            HapticManager.shared.tap()
            action()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .bold))
                Text(label)
                    .font(Theme.Typography.bodyBold)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(
                    colors: [Theme.Colors.focusAccent, Theme.Colors.novaAccent],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .clipShape(Capsule())
            .shadow(color: Theme.Colors.novaAccent.opacity(0.40), radius: 14, y: 6)
        }
        .buttonStyle(.plain)
    }

    private func ghostButton(label: String, action: @escaping () -> Void) -> some View {
        Button {
            HapticManager.shared.tick()
            action()
        } label: {
            Text(label)
                .font(Theme.Typography.bodyEmphasized)
                .foregroundStyle(.white.opacity(0.85))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    Capsule().fill(Color.white.opacity(0.10))
                )
                .overlay(
                    Capsule().strokeBorder(.white.opacity(0.18), lineWidth: 1)
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

    // MARK: - Copy

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
                : "Toca «Enviar a Nova» o vuelve a intentar."
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
