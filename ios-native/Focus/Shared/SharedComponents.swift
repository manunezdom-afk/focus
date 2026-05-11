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

    init(
        userText: String,
        summary: String,
        details: String? = nil,
        action: InlineNovaAction? = nil,
        isLoading: Bool = false,
        isError: Bool = false
    ) {
        self.id = UUID()
        self.userText = userText
        self.summary = summary
        self.details = details
        self.action = action
        self.createdAt = Date()
        self.isLoading = isLoading
        self.isError = isError
    }
}

/// View que pinta una `InlineNovaResponse` debajo del FocusBar en Mi Día.
/// - Muestra primero la frase del usuario tenue (contexto).
/// - Después la respuesta de Nova con el marker rómbico cobalto.
/// - Opcionalmente, un botón secundario para "Ver en Calendario", etc.
/// - "Cerrar" siempre disponible — el usuario puede sacarla sin esperar.
struct InlineNovaResponseView: View {
    let response: InlineNovaResponse
    let onAction: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            // Frase del usuario (eco) — tenue, para dar contexto.
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "quote.opening")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textQuaternary)
                Text(response.userText)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .lineLimit(3)
                Spacer(minLength: 0)
            }

            // Respuesta de Nova.
            HStack(alignment: .top, spacing: Theme.Spacing.sm) {
                Circle()
                    .fill(novaTint)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)

                VStack(alignment: .leading, spacing: 4) {
                    if response.isLoading {
                        HStack(spacing: 6) {
                            ProgressView()
                                .controlSize(.small)
                                .tint(Theme.Colors.novaAccent)
                            Text(response.summary)
                                .font(Theme.Typography.subheadEmphasized)
                                .foregroundStyle(Theme.Colors.textPrimary)
                        }
                    } else {
                        Text(response.summary)
                            .font(Theme.Typography.subheadEmphasized)
                            .foregroundStyle(Theme.Colors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let d = response.details, !d.isEmpty {
                        Text(d)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Spacer(minLength: 0)
            }

            // Acciones — chip secundario opcional + cerrar.
            if !response.isLoading {
                HStack(spacing: Theme.Spacing.sm) {
                    if let act = response.action, act != .dismiss {
                        Button(action: onAction) {
                            HStack(spacing: 4) {
                                Text(act.label)
                                Image(systemName: "arrow.up.forward")
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .font(Theme.Typography.subheadEmphasized)
                            .foregroundStyle(Theme.Colors.focusAccent)
                            .padding(.horizontal, Theme.Spacing.sm + 2)
                            .padding(.vertical, 6)
                            .background(
                                Capsule().fill(Theme.Colors.focusAccentSoft)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                    Spacer()
                    Button(action: onDismiss) {
                        Text("Cerrar")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                            .padding(.horizontal, Theme.Spacing.sm)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(Theme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                        .strokeBorder(novaTint.opacity(0.20), lineWidth: Theme.Stroke.hairline)
                )
                .focusCardShadow()
        )
    }

    private var novaTint: Color {
        if response.isError { return Theme.Colors.warning }
        return Theme.Colors.novaAccent
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

    var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            ZStack {
                Circle()
                    .fill(Theme.Colors.focusAccentSoft)
                    .frame(width: 80, height: 80)
                Image(systemName: symbol)
                    .font(.system(size: 30, weight: .light))
                    .foregroundStyle(Theme.Colors.focusAccent)
            }

            VStack(spacing: Theme.Spacing.xs) {
                Text(title)
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(message)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: 300)

            if let actionLabel, let action {
                Button(action: {
                    HapticManager.shared.tap()
                    action()
                }) {
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
                .buttonStyle(.plain)
                .padding(.top, Theme.Spacing.xs)
            }
        }
        .padding(Theme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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

    @FocusState private var isFocused: Bool

    private var canSubmit: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.Spacing.md) {
            // Marca de Nova — anclada a la base junto a los botones.
            ZStack {
                Circle()
                    .fill(Theme.Colors.novaGradient)
                    .frame(width: 30, height: 30)
                NovaSparkMark(size: 13)
            }

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
                    Image(systemName: "mic.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Colors.focusAccent)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle().fill(Theme.Colors.focusAccentSoft)
                        )
                }
                .buttonStyle(.plain)
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
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .strokeBorder(
                    isFocused
                        ? AnyShapeStyle(Theme.Colors.novaGradient)
                        : AnyShapeStyle(Theme.Colors.border),
                    lineWidth: isFocused ? 1.5 : Theme.Stroke.hairline
                )
        )
        .focusCardShadow()
        .animation(.easeInOut(duration: 0.2), value: isFocused)
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
            Text(label.uppercased())
                .font(Theme.Typography.caption)
                .tracking(0.7)
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

    static let defaultGradient = LinearGradient(
        colors: [
            Color(red: 0.180, green: 0.310, blue: 0.910),  // #2E4FE8 cobalto vivo
            Color(red: 0.094, green: 0.184, blue: 0.510)   // #182F82 azul profundo
        ],
        startPoint: .top,
        endPoint: .bottom
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

            // Anillo exterior — orbita amplia, leve.
            Circle()
                .strokeBorder(Color.white.opacity(0.55), lineWidth: max(0.8, size * 0.028))
                .frame(width: size * 0.70, height: size * 0.70)

            // Anillo medio — borde del foco / aperture.
            Circle()
                .strokeBorder(Color.white, lineWidth: max(1, size * 0.050))
                .frame(width: size * 0.44, height: size * 0.44)

            // Núcleo sólido — el punto de foco, la mente centrada.
            Circle()
                .fill(Color.white)
                .frame(width: size * 0.18, height: size * 0.18)
        }
        .frame(width: size, height: size)
    }
}

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

    var body: some View {
        Button(action: {
            HapticManager.shared.tap()
            action()
        }) {
            HStack(spacing: 8) {
                NovaSparkMark(size: 11, fillColor: AnyShapeStyle(Theme.Colors.novaAccent))
                Text(text)
                    .font(Theme.Typography.subheadEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.forward")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
            .padding(.horizontal, Theme.Spacing.md + 2)
            .padding(.vertical, Theme.Spacing.md - 1)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
            )
            .focusCardShadow()
        }
        .buttonStyle(.plain)
    }
}
