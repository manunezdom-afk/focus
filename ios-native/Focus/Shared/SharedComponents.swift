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

// MARK: - Gemini-style FocusBar (prominente, gradient cuando focuseado)

struct FocusBarInput: View {
    @Binding var text: String
    var placeholder: String = "Pregúntale a Nova…"
    var onSubmit: () -> Void
    var onTap: (() -> Void)? = nil
    var onMic: (() -> Void)? = nil

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            // Sparkle con gradiente Nova
            ZStack {
                Circle()
                    .fill(Theme.Colors.novaGradient)
                    .frame(width: 30, height: 30)
                Image(systemName: "sparkle")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
            }

            TextField(placeholder, text: $text, axis: .horizontal)
                .focused($isFocused)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .tint(Theme.Colors.focusAccent)
                .submitLabel(.send)
                .onSubmit {
                    if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        onSubmit()
                    }
                }
                .onTapGesture {
                    onTap?()
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

            if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Button {
                    onSubmit()
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle().fill(Theme.Colors.focusAccent)
                        )
                }
                .buttonStyle(.plain)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, Theme.Spacing.md + 2)
        .padding(.vertical, Theme.Spacing.md - 1)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xxl, style: .continuous)
                .fill(Theme.Colors.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.xxl, style: .continuous)
                .strokeBorder(
                    isFocused
                        ? AnyShapeStyle(Theme.Colors.novaGradient)
                        : AnyShapeStyle(Theme.Colors.border),
                    lineWidth: isFocused ? 1.5 : Theme.Stroke.hairline
                )
        )
        .focusCardShadow()
        .animation(.easeInOut(duration: 0.2), value: isFocused)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: text.isEmpty)
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
        HStack(spacing: 4) {
            Image(systemName: "sparkles")
                .font(.system(size: 9, weight: .semibold))
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
                Image(systemName: "sparkles")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Colors.novaAccent)
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

/// Símbolo Focus V4 — F geométrica blanca + sparkle accent sobre squircle
/// cobalto. Filosofía: estructura, sistema, IA integrada. NO floral.
///
/// Family system:
/// - Focus → cobalto/azul (default).
/// - Kairos (futuro) → violeta/púrpura.
/// - Spark (futuro) → naranja/dorado.
/// Cambiar `gradient` para portar a otra app de la familia.
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
        ZStack(alignment: .topLeading) {
            // Squircle de fondo (iOS aplica esta forma al AppIcon real).
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(gradient)
                .frame(width: size, height: size)
                .shadow(
                    color: shadow ? Color(red: 0.06, green: 0.10, blue: 0.40).opacity(0.32) : .clear,
                    radius: shadow ? size * 0.22 : 0,
                    x: 0,
                    y: shadow ? size * 0.06 : 0
                )

            // F geométrica — 3 rectángulos redondeados.
            // Stem vertical
            RoundedRectangle(cornerRadius: size * 0.012, style: .continuous)
                .fill(Color.white)
                .frame(width: size * 0.125, height: size * 0.59)
                .offset(x: size * 0.275, y: size * 0.205)

            // Top horizontal bar
            RoundedRectangle(cornerRadius: size * 0.012, style: .continuous)
                .fill(Color.white)
                .frame(width: size * 0.44, height: size * 0.125)
                .offset(x: size * 0.275, y: size * 0.205)

            // Middle horizontal bar (más corta)
            RoundedRectangle(cornerRadius: size * 0.012, style: .continuous)
                .fill(Color.white)
                .frame(width: size * 0.35, height: size * 0.105)
                .offset(x: size * 0.275, y: size * 0.44)

            // Sparkle 4-point arriba-derecha — representa Nova/IA integrada.
            SparkleMark()
                .fill(Color.white)
                .frame(width: size * 0.15, height: size * 0.15)
                .offset(x: size * 0.705, y: size * 0.125)
        }
        .frame(width: size, height: size)
    }
}

/// Polígono star de 4 puntas (8 vértices alternando outer/inner).
struct SparkleMark: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let outerR = min(rect.width, rect.height) / 2
        let innerR = outerR * 0.32

        for i in 0..<8 {
            let angle = CGFloat(i) * .pi / 4 - .pi / 2
            let r = i % 2 == 0 ? outerR : innerR
            let x = center.x + cos(angle) * r
            let y = center.y + sin(angle) * r
            if i == 0 {
                path.move(to: CGPoint(x: x, y: y))
            } else {
                path.addLine(to: CGPoint(x: x, y: y))
            }
        }
        path.closeSubpath()
        return path
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
            HStack(spacing: 6) {
                Image(systemName: "sparkle")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Colors.novaAccent)
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
