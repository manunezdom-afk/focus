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

    func tap() {
        lightImpact.impactOccurred(intensity: 0.7)
    }

    func tick() {
        selection.selectionChanged()
    }

    func success() {
        notification.notificationOccurred(.success)
    }

    func warning() {
        notification.notificationOccurred(.warning)
    }

    func error() {
        notification.notificationOccurred(.error)
    }
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
            Image(systemName: symbol)
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Theme.Colors.novaAccent.opacity(0.9))
                .padding(Theme.Spacing.xl)
                .background(
                    Circle()
                        .fill(Theme.Colors.surfaceElevated)
                        .overlay(
                            Circle()
                                .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                        )
                )

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
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.vertical, Theme.Spacing.md)
                        .background(
                            Capsule()
                                .fill(Theme.Colors.novaAccentSoft)
                                .overlay(
                                    Capsule()
                                        .strokeBorder(Theme.Colors.novaAccent.opacity(0.55), lineWidth: Theme.Stroke.hairline)
                                )
                        )
                }
                .buttonStyle(.plain)
                .padding(.top, Theme.Spacing.xs)
            }
        }
        .padding(Theme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - FocusBar input (visual; lleva texto a Nova)

struct FocusBarInput: View {
    @Binding var text: String
    var placeholder: String = "Habla con Nova…"
    var onSubmit: () -> Void
    var onMic: (() -> Void)? = nil
    var onCamera: (() -> Void)? = nil

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: "sparkles")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Theme.Colors.novaAccent)

            TextField(placeholder, text: $text, axis: .horizontal)
                .focused($isFocused)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .tint(Theme.Colors.novaAccent)
                .submitLabel(.send)
                .onSubmit {
                    if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        onSubmit()
                    }
                }

            HStack(spacing: Theme.Spacing.lg) {
                if let onCamera {
                    Button(action: onCamera) {
                        Image(systemName: "camera")
                            .font(.system(size: 16))
                            .foregroundStyle(Theme.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
                if let onMic {
                    Button(action: onMic) {
                        Image(systemName: "mic")
                            .font(.system(size: 16))
                            .foregroundStyle(Theme.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.md + 2)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.surfaceElevated)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .strokeBorder(
                            isFocused ? Theme.Colors.novaAccent.opacity(0.55) : Theme.Colors.border,
                            lineWidth: Theme.Stroke.hairline
                        )
                )
        )
    }
}

// MARK: - Pill chip (filtros, prioridades, secciones)

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
                .foregroundStyle(isSelected ? Theme.Colors.textPrimary : Theme.Colors.textSecondary)
                .padding(.horizontal, Theme.Spacing.md + 2)
                .padding(.vertical, Theme.Spacing.sm - 1)
                .background(
                    Capsule()
                        .fill(isSelected ? Theme.Colors.surfaceHigh : Theme.Colors.surface)
                        .overlay(
                            Capsule()
                                .strokeBorder(
                                    isSelected ? Theme.Colors.borderEmphasis : Theme.Colors.border,
                                    lineWidth: Theme.Stroke.hairline
                                )
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Pill estática (etiqueta de tipo/sección/estado)

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
                .fill(tint.opacity(0.12))
                .overlay(
                    Capsule()
                        .strokeBorder(tint.opacity(0.30), lineWidth: Theme.Stroke.hairline)
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

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(
                Circle()
                    .fill(tint.opacity(0.14))
                    .overlay(
                        Circle()
                            .strokeBorder(tint.opacity(0.30), lineWidth: Theme.Stroke.hairline)
                    )
            )
    }
}
