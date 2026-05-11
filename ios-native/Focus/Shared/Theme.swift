import SwiftUI

/// Paleta y tokens de Focus.
/// Estética: oscuro navy premium, cercano a Things 3 / Linear / Apple Calendar.
enum Theme {

    // MARK: - Colors

    enum Colors {
        // Fondo base (#06080F)
        static let background = Color(red: 0.024, green: 0.031, blue: 0.059)
        // Superficies (#11141D)
        static let surface = Color(red: 0.067, green: 0.078, blue: 0.114)
        // Superficie elevada (#151923)
        static let surfaceElevated = Color(red: 0.082, green: 0.098, blue: 0.137)
        // Superficie hover/high (#191D28)
        static let surfaceHigh = Color(red: 0.098, green: 0.114, blue: 0.157)
        // Borde sutil (#252A38)
        static let border = Color(red: 0.145, green: 0.165, blue: 0.220)
        // Borde con énfasis
        static let borderEmphasis = Color(red: 0.22, green: 0.24, blue: 0.32)

        // Texto principal (#F4F6FA)
        static let textPrimary = Color(red: 0.957, green: 0.965, blue: 0.980)
        // Texto secundario (#A4A7B5)
        static let textSecondary = Color(red: 0.643, green: 0.655, blue: 0.710)
        // Texto terciario (#6F7280)
        static let textTertiary = Color(red: 0.435, green: 0.447, blue: 0.502)
        // Texto muy apagado
        static let textQuaternary = Color(red: 0.30, green: 0.31, blue: 0.36)

        // Acento Nova (#A78BFA)
        static let novaAccent = Color(red: 0.655, green: 0.545, blue: 0.980)
        static let novaAccentSoft = Color(red: 0.608, green: 0.486, blue: 1.0).opacity(0.18)
        // Acento Focus (#5B8CFF)
        static let focusAccent = Color(red: 0.357, green: 0.549, blue: 1.0)

        // Estados
        static let success = Color(red: 0.369, green: 0.902, blue: 0.659)  // #5EE6A8
        static let warning = Color(red: 1.0, green: 0.733, blue: 0.30)
        static let danger = Color(red: 1.0, green: 0.451, blue: 0.451)

        // Colores de sección (timeline / cards de evento)
        static let sectionFoco = Color(red: 0.369, green: 0.902, blue: 0.659)        // verde foco
        static let sectionReunion = Color(red: 0.357, green: 0.549, blue: 1.0)       // azul focus
        static let sectionPersonal = Color(red: 0.780, green: 0.506, blue: 0.949)    // violet/pink suave
        static let sectionEstudio = Color(red: 0.455, green: 0.878, blue: 0.855)     // cyan/teal suave
        static let sectionDescanso = Color(red: 1.0, green: 0.663, blue: 0.302)      // amber suave
        static let sectionReminder = Color(red: 1.0, green: 0.824, blue: 0.302)      // yellow suave

        // Prioridades
        static let priorityHigh = Color(red: 1.0, green: 0.451, blue: 0.451)         // rojo suave (no alarmista)
        static let priorityMedium = Color(red: 1.0, green: 0.733, blue: 0.30)        // ámbar
        static let priorityLow = Color(red: 0.435, green: 0.447, blue: 0.502)        // gris
    }

    // MARK: - Typography

    enum Typography {
        static let display = Font.system(size: 34, weight: .bold)
        static let title = Font.system(size: 30, weight: .bold)
        static let title2 = Font.system(size: 22, weight: .semibold)
        static let headline = Font.system(size: 17, weight: .semibold)
        static let body = Font.system(size: 15, weight: .regular)
        static let bodyEmphasized = Font.system(size: 15, weight: .medium)
        static let bodyBold = Font.system(size: 15, weight: .semibold)
        static let subhead = Font.system(size: 13, weight: .regular)
        static let subheadEmphasized = Font.system(size: 13, weight: .medium)
        static let footnote = Font.system(size: 12, weight: .medium)
        static let caption = Font.system(size: 11, weight: .medium)
        static let captionEmphasized = Font.system(size: 11, weight: .semibold)
        static let timestamp = Font.system(size: 13, weight: .semibold).monospacedDigit()
        static let largeNumber = Font.system(size: 26, weight: .bold).monospacedDigit()
    }

    // MARK: - Spacing

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
        static let huge: CGFloat = 48
        /// Inset extra al final de ScrollViews para que el tab bar no tape contenido
        static let bottomBarSafety: CGFloat = 100
    }

    // MARK: - Radius / Stroke

    enum Radius {
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 14
        static let xl: CGFloat = 18
        static let xxl: CGFloat = 24
        static let pill: CGFloat = 999
    }

    enum Stroke {
        static let hairline: CGFloat = 0.5
        static let thin: CGFloat = 1
    }
}

// MARK: - View helpers

extension View {
    /// Aplica estilo de label seccional en mayúsculas (TUS PENDIENTES, PRÓXIMO, etc.)
    func sectionLabelStyle() -> some View {
        self
            .font(Theme.Typography.captionEmphasized)
            .foregroundStyle(Theme.Colors.textTertiary)
            .textCase(.uppercase)
            .tracking(0.9)
    }

    /// Card oscura con borde sutil. Usar como base para superficies.
    func focusCard(
        radius: CGFloat = Theme.Radius.lg,
        elevated: Bool = false,
        padding: CGFloat = Theme.Spacing.lg
    ) -> some View {
        self
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(elevated ? Theme.Colors.surfaceElevated : Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
            )
    }
}
