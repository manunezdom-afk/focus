import SwiftUI
import UIKit

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
