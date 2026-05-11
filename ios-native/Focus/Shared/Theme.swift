import SwiftUI

enum Theme {
    enum Colors {
        // Fondo / superficies
        static let background = Color(red: 0.024, green: 0.031, blue: 0.059)
        static let surface = Color.white.opacity(0.04)
        static let surfaceElevated = Color.white.opacity(0.07)
        static let surfaceHigh = Color.white.opacity(0.10)
        static let border = Color.white.opacity(0.08)
        static let borderEmphasis = Color.white.opacity(0.16)

        // Texto sobre fondo oscuro
        static let textPrimary = Color.white
        static let textSecondary = Color.white.opacity(0.62)
        static let textTertiary = Color.white.opacity(0.42)
        static let textQuaternary = Color.white.opacity(0.26)

        // Acento / semánticos
        static let accent = Color(red: 0.62, green: 0.52, blue: 1.0)
        static let success = Color(red: 0.36, green: 0.84, blue: 0.55)
        static let warning = Color(red: 1.0, green: 0.78, blue: 0.36)
        static let danger = Color(red: 1.0, green: 0.42, blue: 0.42)

        // Colores de sección (timeline Mi Día)
        static let sectionFoco = Color(red: 0.42, green: 0.86, blue: 0.62)
        static let sectionReunion = Color(red: 0.46, green: 0.70, blue: 1.0)
        static let sectionPersonal = Color(red: 0.84, green: 0.58, blue: 1.0)
        static let sectionEvening = Color(red: 1.0, green: 0.74, blue: 0.46)
        static let sectionReminder = Color(red: 1.0, green: 0.82, blue: 0.40)
    }

    enum Typography {
        static let display = Font.system(size: 34, weight: .bold)
        static let title = Font.system(size: 30, weight: .bold)
        static let titleEmphasized = Font.system(size: 22, weight: .semibold)
        static let headline = Font.system(size: 17, weight: .semibold)
        static let body = Font.system(size: 15, weight: .regular)
        static let bodyEmphasized = Font.system(size: 15, weight: .medium)
        static let subhead = Font.system(size: 13, weight: .regular)
        static let footnote = Font.system(size: 12, weight: .medium)
        static let caption = Font.system(size: 11, weight: .medium)
        static let captionEmphasized = Font.system(size: 11, weight: .semibold)
        static let timestamp = Font.system(size: 13, weight: .semibold).monospacedDigit()
    }

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
    }

    enum Radius {
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 14
        static let xl: CGFloat = 18
        static let xxl: CGFloat = 24
    }

    enum Stroke {
        static let hairline: CGFloat = 0.5
        static let thin: CGFloat = 1
    }
}

extension View {
    func sectionLabelStyle() -> some View {
        self
            .font(Theme.Typography.captionEmphasized)
            .foregroundStyle(Theme.Colors.textTertiary)
            .textCase(.uppercase)
            .tracking(0.8)
    }
}

struct SurfaceCard<Content: View>: View {
    var elevated: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(Theme.Spacing.lg)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(elevated ? Theme.Colors.surfaceElevated : Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
            )
    }
}
