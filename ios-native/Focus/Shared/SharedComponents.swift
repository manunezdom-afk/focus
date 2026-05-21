import SwiftUI
import UIKit

// MARK: - Date formatters (cached, locale es_ES)

/// DateFormatters compartidos. Crear `DateFormatter` es caro (~1ms) y SwiftUI
/// recomputa bodies con frecuencia — cacheamos como `static let`.
enum DateFormatters {
    static let hourMinute: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_ES")
        f.dateFormat = "HH:mm"
        return f
    }()

    /// "Lunes, 11 de mayo" (capitalizar primera letra al usar)
    static let weekdayDayMonth: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_ES")
        f.dateFormat = "EEEE, d 'de' MMMM"
        return f
    }()

    /// "Mayo 2026" (capitalizar primera letra al usar)
    static let monthYear: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_ES")
        f.dateFormat = "MMMM yyyy"
        return f
    }()

    /// "Lun" / "Mar" / "Mié" (uppercased al usar)
    static let weekdayShort: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_ES")
        f.dateFormat = "EEE"
        return f
    }()

    /// "Lunes 12" / "Sábado 17" (capitalizar primera letra al usar)
    static let weekdayDay: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_ES")
        f.dateFormat = "EEEE d"
        return f
    }()

    /// "11 may" / "23 dic"
    static let shortDayMonth: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "es_ES")
        f.dateFormat = "d MMM"
        return f
    }()

    /// Capitaliza solo la primera letra de un string.
    static func capitalizeFirst(_ s: String) -> String {
        guard let first = s.first else { return s }
        return first.uppercased() + s.dropFirst()
    }
}

// MARK: - App version helper

enum AppVersion {
    /// "1.0 · build 1" leído del Info.plist de la app.
    static var displayString: String {
        let info = Bundle.main.infoDictionary
        let marketing = (info?["CFBundleShortVersionString"] as? String) ?? "—"
        let build = (info?["CFBundleVersion"] as? String) ?? "—"
        return "\(marketing) · build \(build)"
    }
}

// MARK: - Toast (banner transitorio de feedback)

/// Toast efímero — se muestra arriba de la pantalla y desaparece solo.
/// Usado para confirmar acciones ("Evento creado", "Sugerencia aprobada", etc).
struct Toast: Identifiable, Equatable {
    let id = UUID()
    let message: String
    let symbol: String
    let tint: Color

    static func success(_ message: String, symbol: String = "checkmark.circle.fill") -> Toast {
        Toast(message: message, symbol: symbol, tint: Color(red: 0.20, green: 0.66, blue: 0.32))
    }

    static func info(_ message: String, symbol: String = "info.circle.fill") -> Toast {
        Toast(message: message, symbol: symbol, tint: Color(red: 0.18, green: 0.39, blue: 0.92))
    }

    static func warning(_ message: String, symbol: String = "exclamationmark.triangle.fill") -> Toast {
        Toast(message: message, symbol: symbol, tint: Color(red: 0.95, green: 0.65, blue: 0.15))
    }
}

@MainActor
final class ToastManager: ObservableObject {
    @Published var current: Toast?

    /// Muestra un toast por `duration` segundos. Si ya hay uno, lo reemplaza.
    func show(_ toast: Toast, duration: TimeInterval = 2.4) {
        current = toast
        HapticManager.shared.tick()
        let id = toast.id
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            await MainActor.run {
                if self?.current?.id == id { self?.current = nil }
            }
        }
    }

    func success(_ message: String, symbol: String = "checkmark.circle.fill") {
        show(.success(message, symbol: symbol))
    }
}

struct ToastBanner: View {
    let toast: Toast

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: toast.symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(toast.tint)
            Text(toast.message)
                .font(Theme.Typography.subheadEmphasized)
                .foregroundStyle(Theme.Colors.textPrimary)
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.md + 2)
        .padding(.vertical, Theme.Spacing.sm + 2)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                        .strokeBorder(toast.tint.opacity(0.20), lineWidth: Theme.Stroke.hairline)
                )
                .shadow(color: Color.black.opacity(0.08), radius: 16, y: 4)
        )
        .padding(.horizontal, Theme.Spacing.xl)
    }
}

// MARK: - InlineNovaResponse — respuesta corta de Nova en Mi Día

/// Acción opcional asociada a una respuesta inline de Nova. La interpreta el
/// padre (Mi Día) para no acoplar este componente al `NavigationCoordinator`.
enum InlineNovaAction: Hashable {
    case openCalendar
    case openTasksList
    case openBandeja
    case openChat
    case dismiss

    var label: String {
        switch self {
        case .openCalendar:  return "Ver en Calendario"
        case .openTasksList: return "Ver tarea"
        case .openBandeja:   return "Ver en Bandeja"
        case .openChat:      return "Abrir chat"
        case .dismiss:       return "Cerrar"
        }
    }
}

/// Tono visual de una respuesta inline. Determina el color del acento, el
/// icono del diamante y la animación. Si se deja `nil`, se deriva de
/// `isLoading`/`isError` para mantener compat con call sites antiguos.
enum NovaResponseTone: Equatable {
    /// Acción ejecutada exitosamente (recordatorio/tarea/evento creado).
    /// Tinte verde sutil + ícono ✓ pequeño junto al diamante.
    case success
    /// Nova entendió pero necesita confirmar (típicamente clarify con título
    /// y/o fecha tentativos). Tinte violeta — color de marca. Acompaña con
    /// quick chips si hay.
    case clarify
    /// Algo no salió como esperado y queremos avisar sin alarmar (errores de
    /// red, ambigüedad fuerte, etc). Tinte ámbar cálido, NO rojo.
    case error
    /// Nova está procesando la petición (spinner reemplazado por diamante
    /// breathing).
    case processing
    /// Nova respondió en modo conversación abierta — sin ejecutar nada,
    /// solo charlando o dando consejo. Tono neutral, sin badge de
    /// acción. Introducido 2026-05-15 con el mode classification.
    case chat
}

/// Acción que dispara un chip de propuesta. Si está seteado, el chip NO
/// envía texto — el caller (MiDiaView) ejecuta la acción correspondiente.
enum NovaProposalAction: Equatable {
    /// Aplica las propuestas pendientes (mode=proposal). El caller ejecuta
    /// `proposedActions` del último Result via applyBackendActions.
    case apply
    /// Descarta la propuesta sin hacer nada. Cierra la card.
    case dismiss
    /// Abre Nova chat para que el user edite/elabore la propuesta.
    case edit
}

/// Chip de respuesta rápida que aparece en estado `.clarify` o como
/// acción rápida de una propuesta. Tres modos:
/// 1. `sendText` no-nil: el chip "escribe" ese texto en nombre del user.
/// 2. `proposalAction` no-nil: el chip dispara una acción de propuesta
///    (Aplicar / Editar / Descartar).
/// 3. Ambos nil: el chip solo dispara un callback custom del caller.
struct NovaQuickChip: Equatable {
    let id: UUID
    let label: String
    /// Texto que se envía a Nova como si el usuario lo hubiera escrito.
    /// Si es `nil`, el chip solo dispara un callback custom (manejado por
    /// el caller que setea el chip).
    let sendText: String?
    /// Acción de propuesta (Aplicar / Editar / Descartar). Solo se usa
    /// cuando InlineNovaResponse tiene una proposal pendiente en
    /// MiDiaView. Si es no-nil, `sendText` debe ser nil.
    let proposalAction: NovaProposalAction?

    init(label: String, sendText: String? = nil,
         proposalAction: NovaProposalAction? = nil) {
        self.id = UUID()
        self.label = label
        self.sendText = sendText
        self.proposalAction = proposalAction
    }
}

/// Respuesta inline de Nova que se muestra debajo del FocusBar en Mi Día.
/// Es transitoria: el usuario la puede cerrar manualmente o se reemplaza al
/// enviar otra petición. NO va al historial del chat por defecto — para eso
/// existe el tab Nova → Chat.
struct InlineNovaResponse: Identifiable, Equatable {
    let id: UUID
    var userText: String
    var summary: String
    var details: String?
    var action: InlineNovaAction?
    var createdAt: Date
    var isLoading: Bool
    var isError: Bool
    /// Tono visual (success/clarify/error/processing). Si nil, se deriva.
    var tone: NovaResponseTone?
    /// Chips de respuesta rápida — solo se muestran en estado `.clarify`.
    var quickChips: [NovaQuickChip]

    init(
        userText: String,
        summary: String,
        details: String? = nil,
        action: InlineNovaAction? = nil,
        isLoading: Bool = false,
        isError: Bool = false,
        tone: NovaResponseTone? = nil,
        quickChips: [NovaQuickChip] = []
    ) {
        self.id = UUID()
        self.userText = userText
        self.summary = summary
        self.details = details
        self.action = action
        self.createdAt = Date()
        self.isLoading = isLoading
        self.isError = isError
        self.tone = tone
        self.quickChips = quickChips
    }

    /// Tono efectivo — usa el override si se proveyó, sino deriva de los flags.
    var effectiveTone: NovaResponseTone {
        if let tone { return tone }
        if isLoading { return .processing }
        if isError { return .error }
        // Si tiene acción de "abrir" algo creado (calendario/tarea) y no es
        // error → claramente success. Sino, asumir clarify (Nova hizo una
        // pregunta o no creó nada).
        switch action {
        case .openCalendar, .openTasksList, .openBandeja:
            return .success
        default:
            return .clarify
        }
    }
}

/// View premium que pinta una `InlineNovaResponse` debajo del FocusBar en
/// Mi Día. Tarjeta "NovaCard" con tono visual según estado:
///   - success → tinte verde sutil + ✓ junto al diamante.
///   - clarify → tinte violeta de marca + chips de respuesta rápida.
///   - error   → tinte ámbar (NO rojo) — humano, no alarmante.
///   - processing → diamante breathing + texto "Nova está ordenando esto…".
///
/// Acciones:
///   - Botón primario opcional (Ver en Calendario / Ver tarea / Abrir chat).
///   - Quick chips para `.clarify` (Hoy, Mañana, 15:00, etc).
///   - Cerrar (×) discreto en la esquina superior derecha.
struct InlineNovaResponseView: View {
    let response: InlineNovaResponse
    let onAction: () -> Void
    let onDismiss: () -> Void
    /// Callback opcional cuando el usuario toca un quick chip. Si es nil,
    /// los chips solo cierran la card.
    var onChipTap: ((NovaQuickChip) -> Void)? = nil

    @State private var processingPulse: Bool = false
    @State private var appearScale: CGFloat = 0.94
    @State private var appearOpacity: Double = 0

    private var tone: NovaResponseTone { response.effectiveTone }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            header
            content
            if !response.quickChips.isEmpty && tone == .clarify {
                chipsRow
            }
            if shouldShowActionRow {
                actionRow
            }
        }
        .padding(.horizontal, Theme.Spacing.md + 2)
        .padding(.vertical, Theme.Spacing.md)
        .background(cardBackground)
        .overlay(closeButton, alignment: .topTrailing)
        .scaleEffect(appearScale)
        .opacity(appearOpacity)
        .onAppear {
            withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
                appearScale = 1.0
                appearOpacity = 1.0
            }
            if tone == .processing {
                processingPulse = true
            }
        }
        .onChange(of: tone) { _, newValue in
            processingPulse = (newValue == .processing)
        }
    }

    // MARK: - Header (diamante + estado + frase del usuario)

    private var header: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.sm) {
            diamondBadge
            // Eco del usuario como caption tenue (solo si hay texto).
            if !response.userText.isEmpty {
                Text(response.userText)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer(minLength: 0)
        }
    }

    /// Diamante de Nova animado según tono. El diamante mantiene SIEMPRE
    /// identidad Nova (gradient violeta) en TODOS los estados — el feedback
    /// de éxito/error se da por wash de color sutil del card, no por un
    /// glyph grande encima del diamante. Premium > genérico.
    private var diamondBadge: some View {
        ZStack {
            // Halo gradient sólido cuando processing.
            if tone == .processing {
                Circle()
                    .strokeBorder(Theme.Colors.novaAccent.opacity(0.55), lineWidth: 2)
                    .frame(width: 24, height: 24)
                    .scaleEffect(processingPulse ? 1.7 : 1.0)
                    .opacity(processingPulse ? 0 : 0.9)
                    .animation(
                        .easeOut(duration: 1.3).repeatForever(autoreverses: false),
                        value: processingPulse
                    )
            }
            Circle()
                .fill(Theme.Colors.novaGradient)
                .frame(width: 24, height: 24)
                .shadow(color: Theme.Colors.novaAccent.opacity(0.40), radius: 6, y: 1)
            NovaSparkMark(size: 11)
        }
        .frame(width: 28, height: 28)
    }

    /// Color del acento del card. Antes era muy verde fuerte en success;
    /// ahora `.success` usa nova (violeta), `.error` ámbar suave (no rojo),
    /// `.clarify`/`.processing` violeta Nova. Esto mantiene identidad de
    /// marca consistente — Nova es violeta, no verde gigante.
    private var toneColor: Color {
        switch tone {
        case .success:    return Theme.Colors.novaAccent
        case .clarify:    return Theme.Colors.novaAccent
        case .error:      return Theme.Colors.warning
        case .processing: return Theme.Colors.novaAccent
        // Chat: tinte neutral textSecondary — no enfatiza acción.
        // Para el user es una respuesta de "conversación", no de "logro".
        case .chat:       return Theme.Colors.textSecondary
        }
    }

    // MARK: - Content (summary + details)

    private var content: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(response.summary)
                .font(Theme.Typography.subheadEmphasized)
                .foregroundStyle(Theme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .lineSpacing(2)
            if let d = response.details, !d.isEmpty {
                Text(d)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineSpacing(2)
            }
        }
    }

    // MARK: - Quick chips (clarify)

    private var chipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(response.quickChips, id: \.id) { chip in
                    Button {
                        HapticManager.shared.tap()
                        if let onChipTap {
                            onChipTap(chip)
                        } else {
                            onDismiss()
                        }
                    } label: {
                        Text(chip.label)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Colors.novaAccent)
                            .padding(.horizontal, Theme.Spacing.sm + 2)
                            .padding(.vertical, 6)
                            .background(
                                Capsule().fill(Theme.Colors.novaAccentSoft)
                            )
                            .overlay(
                                Capsule().strokeBorder(
                                    Theme.Colors.novaAccent.opacity(0.25),
                                    lineWidth: Theme.Stroke.hairline
                                )
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.top, 2)
    }

    // MARK: - Action row (botón primario solo)

    private var shouldShowActionRow: Bool {
        guard !response.isLoading else { return false }
        guard let act = response.action, act != .dismiss else { return false }
        return true
    }

    private var actionRow: some View {
        HStack(spacing: Theme.Spacing.sm) {
            if let act = response.action, act != .dismiss {
                Button(action: onAction) {
                    HStack(spacing: 4) {
                        Text(act.label)
                        Image(systemName: "arrow.up.forward")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .font(Theme.Typography.subheadEmphasized)
                    .foregroundStyle(toneColor)
                    .padding(.horizontal, Theme.Spacing.sm + 2)
                    .padding(.vertical, 6)
                    .background(
                        Capsule().fill(toneColor.opacity(0.12))
                    )
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    // MARK: - Close button (×)

    private var closeButton: some View {
        Button(action: onDismiss) {
            Image(systemName: "xmark")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Colors.textTertiary)
                .frame(width: 22, height: 22)
                .background(
                    Circle().fill(Theme.Colors.surfaceHigh.opacity(0.7))
                )
        }
        .buttonStyle(.plain)
        .padding(8)
        .accessibilityLabel("Cerrar")
    }

    // MARK: - Background

    private var cardBackground: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(Theme.Colors.surface)
            // Wash de color sutil según tono — solo perceptible, no agresivo.
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(toneColor.opacity(0.05))
            // Stroke con tono.
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .strokeBorder(toneColor.opacity(0.22), lineWidth: 1)
        }
        .focusCardShadow()
    }
}

// MARK: - SwipeToDelete (arrastrar para borrar)

/// Wrapper reutilizable que permite arrastrar una fila hacia la izquierda
/// para borrarla, estilo nativo iOS.
///
/// Funcionamiento:
/// - El gesto se registra como `simultaneousGesture` para no pelear con el
///   scroll vertical del padre.
/// - Solo responde cuando el movimiento es **dominantemente horizontal hacia
///   la izquierda** (`abs(width) > abs(height)` y `width < 0`).
/// - Pasa el umbral (`commitThreshold`) → confirma el delete al soltar.
/// - Animación de salida hacia la izquierda + callback `onDelete`.
/// - Tap en el fondo rojo expuesto también dispara delete (atajo para iPad/uso
///   con accesibilidad).
struct SwipeToDelete<Content: View>: View {
    let content: Content
    let onDelete: () -> Void
    var enabled: Bool = true

    @State private var offset: CGFloat = 0
    @State private var isDeleting: Bool = false

    private let maxReveal: CGFloat = 92
    private let commitThreshold: CGFloat = 70

    init(enabled: Bool = true, onDelete: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.enabled = enabled
        self.onDelete = onDelete
        self.content = content()
    }

    var body: some View {
        ZStack(alignment: .trailing) {
            // Fondo rojo con basurero (visible cuando el usuario arrastra).
            if enabled && offset < -2 {
                Button(action: commitDelete) {
                    HStack {
                        Spacer()
                        Image(systemName: "trash.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.trailing, 22)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .fill(Theme.Colors.danger)
                    )
                    .opacity(min(1, Double(-offset) / Double(maxReveal)))
                }
                .buttonStyle(.plain)
                .transition(.opacity)
            }

            // Contenido offsetteado horizontalmente. La rama explícita evita
            // pasar `nil` a `simultaneousGesture` (no es un overload válido y
            // puede hacer que SwiftUI ignore el gesto silenciosamente).
            Group {
                if enabled {
                    content
                        .offset(x: offset)
                        .simultaneousGesture(swipeGesture)
                } else {
                    content
                }
            }
            .animation(.spring(response: 0.32, dampingFraction: 0.85), value: offset)
        }
        .clipped()
    }

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                let h = value.translation.width
                let v = value.translation.height
                // Solo responder a drags dominantemente horizontales a la izquierda.
                guard h < 0, abs(h) > abs(v) else { return }
                offset = max(h, -maxReveal)
            }
            .onEnded { value in
                if value.translation.width < -commitThreshold {
                    commitDelete()
                } else {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                        offset = 0
                    }
                }
            }
    }

    private func commitDelete() {
        guard !isDeleting else { return }
        isDeleting = true
        HapticManager.shared.warning()
        withAnimation(.easeIn(duration: 0.20)) {
            offset = -UIScreen.main.bounds.width
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
            onDelete()
        }
    }
}

// MARK: - LocationLabel (tap → sheet "Próximamente Maps")

/// Etiqueta de ubicación tappable. Cuando se conecten integraciones (C5+)
/// abrirá Apple Maps / Google Maps / Waze; por ahora explica el flujo
/// futuro vía `ComingSoonSheet`. No agrega navegación externa.
struct LocationLabel: View {
    let location: String

    @State private var showSheet: Bool = false

    var body: some View {
        Button {
            HapticManager.shared.tick()
            showSheet = true
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "mappin")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Colors.textTertiary)
                Text(location)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .lineLimit(1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showSheet) {
            ComingSoonSheet(
                title: location,
                message: "Más adelante podrás abrir esta ubicación en Apple Maps, Google Maps o Waze con un tap. Por ahora la guardamos como texto.",
                icon: "map.fill",
                iconTint: Theme.Colors.warning
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
    }
}

// MARK: - "Próximamente" sheet reutilizable

/// Sheet informativo para features que todavía no están implementadas.
/// Reemplaza botones muertos por explicaciones honestas.
struct ComingSoonSheet: View {
    let title: String
    let message: String
    var icon: String = "clock.badge"
    var iconTint: Color = Theme.Colors.focusAccent
    var secondaryAction: (label: String, action: () -> Void)? = nil

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            ZStack {
                Circle()
                    .fill(iconTint.opacity(0.12))
                    .frame(width: 64, height: 64)
                Image(systemName: icon)
                    .font(.system(size: 26, weight: .regular))
                    .foregroundStyle(iconTint)
            }
            .padding(.top, Theme.Spacing.xl)

            VStack(spacing: Theme.Spacing.sm) {
                Text(title)
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, Theme.Spacing.xl)

            Spacer(minLength: Theme.Spacing.md)

            VStack(spacing: Theme.Spacing.sm) {
                if let secondary = secondaryAction {
                    Button {
                        dismiss()
                        // Pequeño delay para que el sheet cierre antes de
                        // disparar la siguiente acción.
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            secondary.action()
                        }
                    } label: {
                        Text(secondary.label)
                            .font(Theme.Typography.bodyBold)
                            .foregroundStyle(Theme.Colors.focusAccent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Theme.Spacing.md + 2)
                            .background(
                                Capsule()
                                    .fill(Theme.Colors.focusAccentSoft)
                            )
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    dismiss()
                } label: {
                    Text("Entendido")
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Spacing.md + 2)
                        .background(
                            Capsule()
                                .fill(Theme.Colors.focusAccent)
                        )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, Theme.Spacing.xl)
            .padding(.bottom, Theme.Spacing.xl)
        }
        .frame(maxWidth: .infinity)
        .background(Theme.Colors.background)
    }
}

// MARK: - Haptics

final class HapticManager {
    static let shared = HapticManager()

    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let selection = UISelectionFeedbackGenerator()
    private let notification = UINotificationFeedbackGenerator()

    private init() {
        lightImpact.prepare()
        mediumImpact.prepare()
        selection.prepare()
        notification.prepare()
    }

    func tap() { lightImpact.impactOccurred(intensity: 0.7) }
    func tick() { selection.selectionChanged() }
    func success() { notification.notificationOccurred(.success) }
    func warning() { notification.notificationOccurred(.warning) }
    func error() { notification.notificationOccurred(.error) }
}

// MARK: - Empty state

struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String
    var actionLabel: String? = nil
    var action: (() -> Void)? = nil
    /// Cuando `true` el botón de acción usa look "AI": gradient violeta→azul
    /// (estilo Gemini), sparkle leading, glow más fuerte. Solo se prende
    /// para acciones que abren Nova/chat — no para acciones neutras como
    /// "Crear evento". Default false mantiene el look sólido cobalto.
    var aiStyledAction: Bool = false

    // Theme 2.0: staggered fade-in. Cada elemento entra con 60ms de delay
    // sobre el anterior para crear secuencia visual ordenada en empty states
    // (típicamente la primera impresión de una pantalla vacía).
    @State private var glyphAppear: Bool = false
    @State private var textAppear: Bool = false
    @State private var actionAppear: Bool = false

    var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            // Theme 2.0: glifo lineal grande (64pt weight .light) sobre
            // textTertiary opacity 0.5 — composición más calmada que el
            // círculo cobalto saturado anterior. La identidad cromática
            // viene del action button, no del glifo.
            Image(systemName: symbol)
                .font(.system(size: 64, weight: .light))
                .foregroundStyle(Theme.Colors.textTertiary.opacity(0.5))
                .opacity(glyphAppear ? 1 : 0)
                .offset(y: glyphAppear ? 0 : 8)

            VStack(spacing: Theme.Spacing.xs) {
                Text(title)
                    // Title1 24pt SemiBold + tracking -0.72 — más display
                    // que title2 anterior, con weight propio que distingue
                    // un empty hero de un title2 de card.
                    .font(Theme.Typography.title1)
                    .tracking(Theme.Tracking.title1)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(Theme.Typography.body)
                    .tracking(Theme.Tracking.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: 320)
            .opacity(textAppear ? 1 : 0)
            .offset(y: textAppear ? 0 : 8)

            if let actionLabel, let action {
                Button(action: {
                    HapticManager.shared.tap()
                    action()
                }) {
                    if aiStyledAction {
                        // Botón "AI" estilo Gemini: gradient violeta→azul
                        // + sparkles icon leading. Para "Hablar con Nova"
                        // u otras acciones que abren la IA — el degrade
                        // comunica "esto va al asistente inteligente".
                        HStack(spacing: 8) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white)
                            Text(actionLabel)
                                .font(Theme.Typography.bodyBold)
                                .foregroundStyle(.white)
                        }
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.vertical, Theme.Spacing.md)
                        .background(
                            Capsule().fill(
                                LinearGradient(
                                    gradient: Gradient(stops: [
                                        // Multi-stop violeta → púrpura
                                        // intermedio → cobalto. El final
                                        // azul es lo que el usuario pidió:
                                        // "degrade hacia azul, estilo
                                        // Gemini, más IA". 3 stops dan
                                        // profundidad sin gritar.
                                        .init(color: Theme.Colors.novaAccent, location: 0.00),
                                        .init(color: Color(red: 0.42, green: 0.42, blue: 0.97), location: 0.55),
                                        .init(color: Theme.Colors.focusAccent, location: 1.00),
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                        )
                        .shadow(color: Theme.Colors.novaAccent.opacity(0.32), radius: 16, y: 6)
                    } else {
                        Text(actionLabel)
                            .font(Theme.Typography.bodyBold)
                            .foregroundStyle(.white)
                            .padding(.horizontal, Theme.Spacing.xl)
                            .padding(.vertical, Theme.Spacing.md)
                            .background(
                                Capsule().fill(Theme.Colors.focusAccent)
                            )
                            .focusCardShadow()
                    }
                }
                .buttonStyle(.plain)
                .padding(.top, Theme.Spacing.xs)
                .opacity(actionAppear ? 1 : 0)
                .offset(y: actionAppear ? 0 : 8)
            }
        }
        .padding(Theme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Theme 2.0: staggered entrance — glifo → texto (60ms) → action (120ms).
        // Total 240ms para sensación intencional, no súbita.
        .onAppear {
            withAnimation(Theme.Spring.entrance) { glyphAppear = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.06) {
                withAnimation(Theme.Spring.entrance) { textAppear = true }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                withAnimation(Theme.Spring.entrance) { actionAppear = true }
            }
        }
    }
}

// MARK: - FocusBar — input multilínea expandible

/// Input principal de Mi Día para hablar con Nova. Soporta de 1 a 5 líneas
/// visibles (crece hacia abajo), después scroll interno. Botones (mic, enviar)
/// se anclan a la base para que no salten cuando el texto crece.
///
/// Submit:
/// - botón flecha o tecla "Send" del teclado;
/// - solo se dispara con texto no-vacío;
/// - el padre decide qué hacer con el texto (Mi Día lo procesa inline, NO
///   navega al Chat).
///
/// `onTap` se dispara con cualquier tap en el área de texto. Mi Día lo usa
/// solo cuando el campo está vacío para enfocar; no debe navegar.
struct FocusBarInput: View {
    @Binding var text: String
    var placeholder: String = "Pregúntale a Nova…"
    var onSubmit: () -> Void
    var onMic: (() -> Void)? = nil
    /// Estado de dictado en vivo. Cuando es `true`, el icono mic se
    /// convierte en un "stop" pulsante para indicar que está escuchando.
    /// El padre maneja el ciclo on/off via `onMic`.
    var isDictating: Bool = false
    /// Nivel de audio normalizado (0..1) del dictation service. Se usa para
    /// hacer breathing del diamante de Nova: la escala oscila siguiendo la
    /// voz, dando feedback inmediato de que el mic está captando audio
    /// (vs estar pegado en "escuchando" sin captar nada).
    var audioLevel: CGFloat = 0

    @FocusState private var isFocused: Bool
    @State private var dictationPulse: Bool = false

    private var canSubmit: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Escala base del diamante: 1.0 normal, +0..25% según audioLevel cuando
    /// está dictando. Smooth con `.animation` en el caller para sentir
    /// breathing en vez de cambios bruscos.
    private var diamondScale: CGFloat {
        guard isDictating else { return 1.0 }
        let clamped = max(0, min(1, audioLevel))
        return 1.0 + clamped * 0.25
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.Spacing.md) {
            // Marca de Nova — anclada a la base junto a los botones. Cuando
            // está dictando, el diamante "cobra vida":
            //   - escala según audioLevel (breathing siguiendo la voz)
            //   - halo gradient pulsando que irradia hacia afuera
            //   - glow + shadow más intensos
            // Reemplaza el viejo label flotante "Escuchando…" que estorbaba.
            ZStack {
                // Halo expansivo cuando dicta — irradia gradient violeta.
                if isDictating {
                    Circle()
                        .strokeBorder(
                            Theme.Colors.novaAccent.opacity(0.55),
                            lineWidth: 2
                        )
                        .frame(width: 30, height: 30)
                        .scaleEffect(dictationPulse ? 2.0 : 1.0)
                        .opacity(dictationPulse ? 0 : 0.9)
                        .animation(
                            .easeOut(duration: 1.4).repeatForever(autoreverses: false),
                            value: dictationPulse
                        )
                }
                Circle()
                    .fill(Theme.Colors.novaGradient)
                    .frame(width: 30, height: 30)
                    .shadow(
                        color: Theme.Colors.novaAccent.opacity(isDictating ? 0.7 : 0.35),
                        radius: isDictating ? 12 : 6,
                        y: 0
                    )
                NovaSparkMark(size: 13)
            }
            .scaleEffect(diamondScale)
            .animation(.easeOut(duration: 0.12), value: diamondScale)

            TextField(placeholder, text: $text, axis: .vertical)
                .focused($isFocused)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .tint(Theme.Colors.focusAccent)
                // 1 a 5 líneas visibles; pasado eso TextField hace scroll
                // interno y conserva el cursor visible.
                .lineLimit(1...5)
                .submitLabel(.send)
                // Enter en multiline manda submit (no inserta newline) cuando
                // hay texto. Si el usuario quiere salto de línea explícito
                // puede mantener Shift+Enter (lo respeta el sistema).
                .onSubmit {
                    if canSubmit { onSubmit() }
                }
                // padding vertical mínimo para que el área de toque sea
                // cómoda incluso con 1 línea.
                .padding(.vertical, 4)
                // Toolbar "Listo" sobre el teclado para cerrarlo
                // explícitamente. iOS lo muestra solo cuando el campo está
                // enfocado.
                .toolbar {
                    ToolbarItemGroup(placement: .keyboard) {
                        Spacer()
                        Button("Listo") {
                            isFocused = false
                        }
                        .foregroundStyle(Theme.Colors.focusAccent)
                        .fontWeight(.semibold)
                    }
                }

            if let onMic {
                Button(action: onMic) {
                    Image(systemName: isDictating ? "stop.fill" : "mic.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(isDictating ? .white : Theme.Colors.focusAccent)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle().fill(
                                isDictating
                                    ? Theme.Colors.focusAccent
                                    : Theme.Colors.focusAccentSoft
                            )
                        )
                        .overlay(
                            // Halo pulsante cuando dicta — feedback visual
                            // inmediato sin sheet ni popup.
                            Circle()
                                .strokeBorder(
                                    Theme.Colors.focusAccent.opacity(isDictating ? 0.45 : 0),
                                    lineWidth: 2
                                )
                                .scaleEffect(isDictating && dictationPulse ? 1.55 : 1.0)
                                .opacity(isDictating && dictationPulse ? 0 : 1)
                                .animation(
                                    isDictating
                                        ? .easeOut(duration: 1.2).repeatForever(autoreverses: false)
                                        : .default,
                                    value: dictationPulse
                                )
                        )
                }
                .buttonStyle(.plain)
                .onChange(of: isDictating) { _, dictating in
                    if dictating {
                        dictationPulse = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                            dictationPulse = true
                        }
                    } else {
                        dictationPulse = false
                    }
                }
            }

            // Botón enviar siempre visible para no romper el layout al teclear;
            // se desactiva cuando no hay texto.
            Button {
                if canSubmit { onSubmit() }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle().fill(
                            canSubmit
                                ? Theme.Colors.focusAccent
                                : Theme.Colors.focusAccent.opacity(0.30)
                        )
                    )
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit)
            .animation(.easeInOut(duration: 0.15), value: canSubmit)
        }
        .padding(.horizontal, Theme.Spacing.md + 2)
        .padding(.vertical, Theme.Spacing.sm + 2)
        // Theme 2.0 FASE 2: FocusBar como elemento flotante Z-2 con
        // identidad Nova MUY visible. Subimos opacity del tinte (5% → 9%),
        // del borde NovaPrism (0.45 → 0.85 idle, lineWidth 0.7 → 1.2) y
        // de la sombra Nova (cardShadow → novaAccent glow). Antes el
        // gradient borde era sutil cuando idle — ahora se ve siempre.
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                    .fill(.ultraThinMaterial)
                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                    .fill(Theme.Colors.novaAccent.opacity(0.09))
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .strokeBorder(
                    Theme.Colors.novaPrismGradient,
                    lineWidth: isFocused ? 1.8 : 1.2
                )
                .opacity(isFocused ? 1.0 : 0.85)
        )
        .shadow(
            color: Theme.Colors.novaAccent.opacity(isFocused ? 0.32 : 0.18),
            radius: isFocused ? 22 : 14,
            x: 0,
            y: isFocused ? 8 : 5
        )
        .animation(Theme.Motion.easeInOutStandard, value: isFocused)
    }
}

// MARK: - Filter chip

struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.tick()
            action()
        }) {
            Text(label)
                .font(Theme.Typography.subheadEmphasized)
                .foregroundStyle(isSelected ? .white : Theme.Colors.textSecondary)
                .padding(.horizontal, Theme.Spacing.md + 2)
                .padding(.vertical, Theme.Spacing.sm)
                .background(
                    Capsule()
                        .fill(isSelected ? Theme.Colors.focusAccent : Theme.Colors.surface)
                        .overlay(
                            Capsule()
                                .strokeBorder(
                                    isSelected ? Color.clear : Theme.Colors.border,
                                    lineWidth: Theme.Stroke.hairline
                                )
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - StatePill (etiqueta de tipo/sección/estado)

struct StatePill: View {
    let label: String
    let tint: Color
    var symbol: String? = nil

    var body: some View {
        HStack(spacing: 4) {
            if let symbol {
                Image(systemName: symbol)
                    .font(.system(size: 9, weight: .semibold))
            }
            // Theme 2.0: caption mono + tracking opinado. SF Mono medium
            // da mejor density visual para badges UPPERCASE que SF Pro.
            Text(label.uppercased())
                .font(Theme.Typography.captionMono)
                .tracking(Theme.Tracking.captionMono)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(tint.opacity(0.10))
        )
    }
}

// MARK: - ExampleBadge (marca eventos/tareas como ejemplo)

struct ExampleBadge: View {
    var body: some View {
        HStack(spacing: 5) {
            NovaSparkMark(size: 8, fillColor: AnyShapeStyle(Theme.Colors.novaAccent))
            Text("EJEMPLO")
                .font(Theme.Typography.caption)
                .tracking(0.9)
        }
        .foregroundStyle(Theme.Colors.novaAccent)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(Theme.Colors.novaAccentSoft)
                .overlay(
                    Capsule()
                        .strokeBorder(Theme.Colors.novaAccent.opacity(0.25), lineWidth: Theme.Stroke.hairline)
                )
        )
    }
}

// MARK: - Banner inline para indicar que se ven ejemplos

struct ExampleBanner: View {
    let title: String
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            ZStack {
                Circle()
                    .fill(Theme.Colors.novaAccentSoft)
                    .frame(width: 36, height: 36)
                NovaSparkMark(size: 15, fillColor: AnyShapeStyle(Theme.Colors.novaAccent))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Theme.Typography.bodyBold)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(message)
                    .font(Theme.Typography.subhead)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.leading)
            }
            Spacer()
        }
        .padding(Theme.Spacing.md + 2)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(Theme.Colors.novaAccentSoft)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                        .strokeBorder(
                            Theme.Colors.novaAccent.opacity(0.25),
                            style: StrokeStyle(lineWidth: 1, dash: [5, 4])
                        )
                )
        )
    }
}

// MARK: - Section header

struct SectionHeader: View {
    let title: String
    var trailing: String? = nil

    var body: some View {
        HStack {
            Text(title.uppercased())
                .sectionLabelStyle()
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .tracking(0.4)
            }
        }
    }
}

// MARK: - Round icon badge

struct IconBadge: View {
    let symbol: String
    let tint: Color
    var size: CGFloat = 36
    var filled: Bool = false

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(filled ? .white : tint)
            .frame(width: size, height: size)
            .background(
                Circle()
                    .fill(filled ? AnyShapeStyle(tint) : AnyShapeStyle(tint.opacity(0.12)))
            )
    }
}

// MARK: - Focus brand mark (logo SwiftUI consistente con AppIcon)

/// Símbolo Focus V5 — núcleo sólido + dos anillos concéntricos sobre squircle
/// cobalto. Lectura: aperture / claridad mental / punto de foco. Sin letras,
/// sin pétalos, sin chispitas. Geométrico, premium, App Store-ready.
///
/// Family system (mismo símbolo, distinto gradiente):
/// - Focus → cobalto/azul (default).
/// - Kairos (futuro) → violeta/púrpura.
/// - Spark (futuro) → naranja/dorado.
struct FocusLogoMark: View {
    var size: CGFloat = 96
    var shadow: Bool = true
    var gradient: LinearGradient = FocusLogoMark.defaultGradient

    /// Gradient diagonal multi-stop: electric cobalt → focus blue → deep
    /// navy → toque violeta. Más vivo que el dos-stops anterior, mantiene
    /// el azul como identidad dominante y deja un guiño violet hacia el
    /// borde inferior derecho — el mismo guiño Nova del gradient interno
    /// (`Theme.Colors.novaGradient`).
    static let defaultGradient = LinearGradient(
        gradient: Gradient(stops: [
            .init(color: Color(red: 0.231, green: 0.510, blue: 0.965), location: 0.00),  // electric cobalt
            .init(color: Color(red: 0.145, green: 0.388, blue: 0.922), location: 0.40),  // focus blue
            .init(color: Color(red: 0.094, green: 0.184, blue: 0.510), location: 0.85),  // deep navy
            .init(color: Color(red: 0.180, green: 0.130, blue: 0.520), location: 1.00),  // hint violet
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    var body: some View {
        ZStack {
            // Squircle cobalto — iOS aplica esta forma al AppIcon real.
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(gradient)
                .frame(width: size, height: size)
                .shadow(
                    color: shadow ? Color(red: 0.06, green: 0.10, blue: 0.40).opacity(0.32) : .clear,
                    radius: shadow ? size * 0.22 : 0,
                    x: 0,
                    y: shadow ? size * 0.06 : 0
                )

            // HALO RADIAL — luz blanca difusa detrás del símbolo. Da
            // sensación de "símbolo vivo" sin caer en el target/crosshair
            // de Gemini. Sin estos pixels el centro se ve pegado plano.
            Circle()
                .fill(
                    RadialGradient(
                        gradient: Gradient(stops: [
                            .init(color: Color.white.opacity(0.32), location: 0.0),
                            .init(color: Color(red: 0.65, green: 0.80, blue: 1.0).opacity(0.16), location: 0.55),
                            .init(color: Color.white.opacity(0.0), location: 1.0),
                        ]),
                        center: .center,
                        startRadius: 0,
                        endRadius: size * 0.42
                    )
                )
                .frame(width: size * 0.92, height: size * 0.92)

            // ─── FOCUS MARK: autofocus brackets + center dot ──────────
            // Identidad propia de Focus (la app), distinta del diamond
            // de Nova (la IA). Lectura: "punto de foco enmarcado" — la
            // app es sobre concentración, mientras Nova es el asistente.
            // Cambio 2026-05-15 desde NovaSpark a este mark.
            FocusBracketsMark(size: size)

            // Center dot con glow blanco premium.
            Circle()
                .fill(Color.white)
                .frame(width: size * 0.186, height: size * 0.186)
                .shadow(
                    color: Color.white.opacity(shadow ? 0.70 : 0.45),
                    radius: size * 0.07,
                    x: 0, y: 0
                )
        }
        .frame(width: size, height: size)
    }
}

/// Cuatro corchetes en las esquinas de un cuadrado invisible centrado.
/// Reproduce los autofocus brackets del AppIcon. Implementación con Canvas
/// — coordenadas absolutas, sin scaleEffect ni alignment frames que se
/// confundían con flips. Más predecible y rinde igual de bien.
private struct FocusBracketsMark: View {
    let size: CGFloat

    /// Tamaño del cuadrado invisible que enmarca el dot central.
    private var boxSize: CGFloat { size * 0.58 }
    private var bracketLen: CGFloat { size * 0.137 }
    private var bracketThickness: CGFloat { max(1.5, size * 0.022) }

    var body: some View {
        Canvas { context, canvasSize in
            let cx = canvasSize.width / 2
            let cy = canvasSize.height / 2
            let half = boxSize / 2
            let t = bracketThickness
            let len = bracketLen
            let r = t / 2

            func roundedRect(x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat) {
                let rect = CGRect(x: x, y: y, width: w, height: h)
                let path = Path(roundedRect: rect, cornerSize: CGSize(width: r, height: r))
                context.fill(path, with: .color(.white))
            }

            // TOP-LEFT: H-arm va hacia la derecha desde la esquina TL;
            //           V-arm va hacia abajo desde la esquina TL.
            let tlX = cx - half
            let tlY = cy - half
            roundedRect(x: tlX, y: tlY, w: len, h: t)            // ─
            roundedRect(x: tlX, y: tlY, w: t, h: len)            // │

            // TOP-RIGHT: H-arm va hacia la izquierda; V-arm va hacia abajo.
            let trX = cx + half
            let trY = cy - half
            roundedRect(x: trX - len, y: trY, w: len, h: t)      // ─
            roundedRect(x: trX - t, y: trY, w: t, h: len)        // │

            // BOTTOM-LEFT: H-arm va hacia la derecha; V-arm va hacia arriba.
            let blX = cx - half
            let blY = cy + half
            roundedRect(x: blX, y: blY - t, w: len, h: t)        // ─
            roundedRect(x: blX, y: blY - len, w: t, h: len)      // │

            // BOTTOM-RIGHT: H-arm hacia izquierda; V-arm hacia arriba.
            let brX = cx + half
            let brY = cy + half
            roundedRect(x: brX - len, y: brY - t, w: len, h: t)  // ─
            roundedRect(x: brX - t, y: brY - len, w: t, h: len)  // │
        }
        .frame(width: size, height: size)
        .shadow(color: Color.white.opacity(0.5), radius: size * 0.025, x: 0, y: 0)
    }
}

// Nota histórica: existió un `FocusGearMark` (engranaje 6-dientes)
// hasta el 2026-05-13. Se removió porque hacía que Focus pareciera otra
// app distinta de Nova dentro de la propia app — el usuario veía el
// engranaje en Mi Día/Nova headers y el rombo Nova en chat/FocusBar,
// como si fueran dos productos. Ahora `FocusLogoMark` muestra el rombo
// Nova (NovaSpark) con halo: identidad unificada Focus + Nova.

// MARK: - Nova spark mark (logo propio de Nova, distinto del sparkle 4-point)

/// Marca de Nova — rombo vertical compacto. Diseñado para diferenciarse del
/// sparkle 4-point que usan Gemini/Copilot/etc. Lectura: chispa de claridad,
/// nodo de pensamiento, asistente personal.
///
/// Proporción 0.62:1 (W:H) — el rombo es más alto que ancho, lo que aleja la
/// lectura de "diamante de joya" y la lleva hacia "spark/punto vivo".
struct NovaSparkMark: View {
    var size: CGFloat = 16
    var fillColor: AnyShapeStyle = AnyShapeStyle(Color.white)

    var body: some View {
        NovaSpark()
            .fill(fillColor)
            .frame(width: size * 0.62, height: size)
    }
}

/// Rombo vertical (4 vértices). Pensado para usarse fill-rendered.
struct NovaSpark: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        path.move(to: CGPoint(x: w / 2, y: 0))
        path.addLine(to: CGPoint(x: w, y: h / 2))
        path.addLine(to: CGPoint(x: w / 2, y: h))
        path.addLine(to: CGPoint(x: 0, y: h / 2))
        path.closeSubpath()
        return path
    }
}

/// Header row: logo Focus + fecha de hoy en azul. Aparece arriba a la
/// izquierda de las pantallas principales (Mi Día, Nova) para reforzar
/// identidad y dar contexto temporal de un vistazo.
struct FocusBrandRow: View {
    var size: CGFloat = 26

    var body: some View {
        HStack(spacing: 10) {
            FocusLogoMark(size: size, shadow: false)
            Text(dateLabel)
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.Colors.focusAccent)
                .tracking(0.2)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
    }

    private var dateLabel: String {
        let raw = DateFormatters.weekdayDayMonth.string(from: Date())
        return DateFormatters.capitalizeFirst(raw)
    }
}

/// Wordmark "FOCUS" letter-spaced. Para BootView y headers de marca.
struct FocusWordmark: View {
    var fontSize: CGFloat = 14
    var color: Color = .white
    var tracking: CGFloat = 4

    var body: some View {
        Text("FOCUS")
            .font(.system(size: fontSize, weight: .semibold))
            .foregroundStyle(color)
            .tracking(tracking)
    }
}

// MARK: - Prompt chip (para empty state Mi Día)

struct PromptChip: View {
    let text: String
    let action: () -> Void

    @State private var isPressed: Bool = false

    var body: some View {
        Button(action: {
            HapticManager.shared.tap()
            action()
        }) {
            HStack(spacing: 8) {
                NovaSparkMark(size: 11, fillColor: AnyShapeStyle(Theme.Colors.novaAccent))
                Text(text)
                    .font(Theme.Typography.subheadEmphasized)
                    .tracking(Theme.Tracking.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.forward")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
            .padding(.horizontal, Theme.Spacing.md + 2)
            .padding(.vertical, Theme.Spacing.md - 1)
            // Theme 2.0: borderHairline + sombra ligera Z-1.
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(Theme.Colors.borderHairline, lineWidth: Theme.Stroke.hairline)
                    )
            )
            .focusCardShadow()
            // Theme 2.0: tap feedback con scale 0.97 (MotionSnap 120ms).
            .scaleEffect(isPressed ? 0.97 : 1.0)
            .animation(Theme.Motion.snapTap, value: isPressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

// MARK: - AudioLevelBars (decibeles en vivo)

/// 5 barras verticales animadas que reflejan el nivel de audio en vivo.
/// Las barras del centro son las "más sensibles" (responden más fuerte al
/// nivel), las laterales atenúan — patrón "ecualizador" estándar. Animadas
/// con spring para movimiento orgánico, no robótico.
///
/// `level` debe estar normalizado 0...1 (lo que `NovaLiveService.audioLevel`
/// publica). Sin habla = barras planas. Voz normal = ~50% altura. Voz
/// fuerte = ~80-100%.
struct AudioLevelBars: View {
    /// Nivel de audio actual (0...1). Cambios animados via spring.
    let level: Float

    /// Multiplicadores por barra para crear el efecto "ecualizador" —
    /// el centro responde más, las laterales atenúan. Los valores son
    /// arbitrarios pero coreografeados para que parezca natural.
    private let multipliers: [CGFloat] = [0.55, 0.85, 1.0, 0.85, 0.55]

    var body: some View {
        HStack(alignment: .center, spacing: 2) {
            ForEach(multipliers.indices, id: \.self) { i in
                Capsule()
                    .fill(Theme.Colors.novaAccent)
                    .frame(width: 2.5, height: barHeight(at: i))
            }
        }
        // Theme 2.0: usar spring interactive tokenizado.
        .animation(Theme.Spring.interactive, value: level)
    }

    /// Altura por barra: piso 3pt (siempre visible aunque haya silencio
    /// total — más profesional que barras invisibles) + porción
    /// proporcional al level × multiplier. Tope a 14pt para no exceder
    /// el contenedor de 14pt que usa Mi Día.
    private func barHeight(at index: Int) -> CGFloat {
        let floor: CGFloat = 3
        let ceiling: CGFloat = 14
        let dynamic = CGFloat(level) * multipliers[index] * (ceiling - floor)
        return floor + dynamic
    }
}

// MARK: - Buttons system (Theme 2.0 — Precision Etherealism)
//
// Familia de 4 botones primarios usados en toda la app. Antes cada vista
// definía sus propios botones a mano (capsule + fill + shadow + text);
// con Theme 2.0 unificamos en componentes con motion + haptics tokenizados.
//
// Reglas comunes:
// - Altura 48pt fija (área táctil generosa Apple HIG).
// - Radius 14 (md) — más recto que los chips/cards (lg=18) por contraste.
// - Texto callout 13pt medium (size de botón estándar Apple).
// - Scale 0.96 + MotionSnap (120ms) al tap, return spring settle.

/// Botón primario — gradient FocusDeep + texto blanco.
/// Para CTAs principales: "Empezar", "Enviar código", "Crear evento".
struct FocusPrimaryButton: View {
    let label: String
    var icon: String? = nil
    var fullWidth: Bool = true
    var action: () -> Void

    @State private var isPressed: Bool = false

    var body: some View {
        Button(action: {
            HapticManager.shared.tap()
            action()
        }) {
            HStack(spacing: 8) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .bold))
                }
                Text(label)
                    .font(Theme.Typography.callout)
                    .fontWeight(.semibold)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(height: 48)
            .padding(.horizontal, fullWidth ? 0 : Theme.Spacing.xl)
            .background(
                Capsule()
                    .fill(Theme.Colors.focusDeepGradient)
            )
            .overlay(
                Capsule()
                    .strokeBorder(Color.white.opacity(0.20), lineWidth: 0.5)
            )
            .shadow(
                color: Theme.Colors.focusAccent.opacity(0.32),
                radius: 14,
                x: 0,
                y: 5
            )
            .scaleEffect(isPressed ? 0.96 : 1.0)
            .animation(Theme.Motion.snapTap, value: isPressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

/// Botón secundario — surface elevated + border hairline + texto secondary.
/// Para acciones de soporte: "Cancelar", "Volver", "Reintentar".
struct FocusSecondaryButton: View {
    let label: String
    var icon: String? = nil
    var fullWidth: Bool = true
    var action: () -> Void

    @State private var isPressed: Bool = false

    var body: some View {
        Button(action: {
            HapticManager.shared.tick()
            action()
        }) {
            HStack(spacing: 8) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                }
                Text(label)
                    .font(Theme.Typography.callout)
                    .fontWeight(.medium)
            }
            .foregroundStyle(Theme.Colors.textSecondary)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(height: 48)
            .padding(.horizontal, fullWidth ? 0 : Theme.Spacing.xl)
            .background(
                Capsule()
                    .fill(Theme.Colors.surfaceL2)
                    .overlay(
                        Capsule()
                            .strokeBorder(Theme.Colors.borderHairline, lineWidth: Theme.Stroke.hairline)
                    )
            )
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(Theme.Motion.snapTap, value: isPressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

/// Botón ghost — sin fill ni border. Solo texto colored.
/// Para acciones discretas inline: "Saltar", "Más tarde", "Ver detalles".
struct FocusGhostButton: View {
    let label: String
    var icon: String? = nil
    var tint: Color = Theme.Colors.focusAccent
    var action: () -> Void

    @State private var isPressed: Bool = false

    var body: some View {
        Button(action: {
            HapticManager.shared.tick()
            action()
        }) {
            HStack(spacing: 6) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                }
                Text(label)
                    .font(Theme.Typography.callout)
                    .fontWeight(.semibold)
            }
            .foregroundStyle(tint)
            .opacity(isPressed ? 0.6 : 1.0)
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.sm)
            .contentShape(Rectangle())
            .animation(Theme.Motion.snapTap, value: isPressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}

/// Botón destructivo — fondo dangerSoft + texto danger.
/// Para acciones irreversibles: "Eliminar evento", "Borrar todo".
///
/// Variante hold-to-confirm: cuando `holdToConfirm = true`, el botón debe
/// mantenerse presionado por 1 segundo. Durante ese tiempo, una barra
/// horizontal rojo sólido crece como confirmación visual. Soltar antes
/// cancela el hold y vuelve a vacío.
struct FocusDestructiveButton: View {
    let label: String
    var icon: String? = "trash"
    var holdToConfirm: Bool = false
    var fullWidth: Bool = true
    var action: () -> Void

    @State private var isPressed: Bool = false
    @State private var holdProgress: CGFloat = 0
    @State private var holdTask: Task<Void, Never>? = nil

    var body: some View {
        Button(action: {
            if !holdToConfirm {
                HapticManager.shared.warning()
                action()
            }
        }) {
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Theme.Colors.dangerSoft)

                // Barra de progreso del hold (sólo si holdToConfirm).
                if holdToConfirm {
                    GeometryReader { geo in
                        Capsule()
                            .fill(Theme.Colors.danger)
                            .frame(width: geo.size.width * holdProgress)
                            .opacity(0.85)
                    }
                }

                HStack(spacing: 8) {
                    if let icon {
                        Image(systemName: icon)
                            .font(.system(size: 14, weight: .bold))
                    }
                    Text(label)
                        .font(Theme.Typography.callout)
                        .fontWeight(.semibold)
                }
                .foregroundStyle(holdProgress > 0.6 ? Color.white : Theme.Colors.danger)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .padding(.horizontal, fullWidth ? 0 : Theme.Spacing.xl)
            }
            .frame(height: 48)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(Theme.Colors.danger.opacity(0.20), lineWidth: 0.5)
            )
            .scaleEffect(isPressed && !holdToConfirm ? 0.96 : 1.0)
            .animation(Theme.Motion.snapTap, value: isPressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !isPressed {
                        isPressed = true
                        if holdToConfirm {
                            startHold()
                        }
                    }
                }
                .onEnded { _ in
                    isPressed = false
                    if holdToConfirm {
                        cancelHold()
                    }
                }
        )
    }

    private func startHold() {
        holdTask?.cancel()
        holdTask = Task {
            let steps = 60
            for i in 1...steps {
                if Task.isCancelled { return }
                try? await Task.sleep(nanoseconds: 1_000_000_000 / UInt64(steps))
                await MainActor.run {
                    withAnimation(.linear(duration: 0.016)) {
                        holdProgress = CGFloat(i) / CGFloat(steps)
                    }
                }
            }
            // Hold completo → ejecutar acción.
            await MainActor.run {
                HapticManager.shared.warning()
                action()
                holdProgress = 0
            }
        }
    }

    private func cancelHold() {
        holdTask?.cancel()
        withAnimation(Theme.Motion.snapTap) {
            holdProgress = 0
        }
    }
}

// MARK: - FocusBadge — pill numérico/indicador

/// Badge pequeño para notificaciones / contadores. Usa CaptionMono.
/// Para usar como indicador de status (PRÓXIMO/EN CURSO/etc) preferir StatePill.
struct FocusBadge: View {
    let label: String
    var tint: Color = Theme.Colors.novaAccent
    var fillStyle: AnyShapeStyle? = nil

    var body: some View {
        Text(label)
            .font(Theme.Typography.captionMono)
            .tracking(Theme.Tracking.captionMono)
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .frame(minWidth: 18, minHeight: 18)
            .background(
                Capsule()
                    .fill(fillStyle ?? AnyShapeStyle(tint))
            )
    }
}

// MARK: - FocusToggle — switch custom con FocusDeep gradient

/// Toggle custom que reemplaza UISwitch nativo (verde sistema) por uno
/// con gradient FocusDeep cuando activo. Más coherente con la marca Focus.
///
/// Uso: `FocusToggle(isOn: $value)` — drop-in replacement para `Toggle`
/// SwiftUI estándar. El label se renderiza separado por convención.
struct FocusToggle: View {
    @Binding var isOn: Bool
    var disabled: Bool = false

    private let width: CGFloat = 51
    private let height: CGFloat = 31
    private let nodeSize: CGFloat = 27

    var body: some View {
        Button {
            HapticManager.shared.tick()
            withAnimation(Theme.Spring.settle) {
                isOn.toggle()
            }
        } label: {
            ZStack(alignment: isOn ? .trailing : .leading) {
                // Track — gradient FocusDeep cuando activo, gris cuando off.
                Capsule()
                    .fill(
                        isOn
                            ? AnyShapeStyle(Theme.Colors.focusDeepGradient)
                            : AnyShapeStyle(Theme.Colors.surfaceL2)
                    )
                    .overlay(
                        Capsule()
                            .strokeBorder(
                                isOn ? Color.clear : Theme.Colors.borderSoft,
                                lineWidth: Theme.Stroke.hairline
                            )
                    )
                    .frame(width: width, height: height)

                // Node deslizante — blanco con sombra táctil + leve overhang.
                Circle()
                    .fill(Color.white)
                    .frame(width: nodeSize, height: nodeSize)
                    .shadow(color: .black.opacity(0.18), radius: 2.5, y: 1.5)
                    .padding(.horizontal, 2)
            }
            .opacity(disabled ? 0.45 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

