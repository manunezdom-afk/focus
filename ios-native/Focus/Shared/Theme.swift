import SwiftUI

/// Paleta y tokens de Focus.
/// Estética: light, limpio, azul-acento. Gemini-inspired pero serio.
/// Pensado para universitarios y trabajadores que necesitan claridad.
enum Theme {

    // MARK: - Colors

    enum Colors {
        // Fondo principal (#FAFBFD - blanco ligeramente cool)
        static let background = Color(red: 0.980, green: 0.984, blue: 0.992)
        // Superficie de cards (blanco puro, ligera elevación)
        static let surface = Color.white
        // Superficie elevada (sheets, modals)
        static let surfaceElevated = Color.white
        // Superficie hover/pressed (#F2F4F8)
        static let surfaceHigh = Color(red: 0.949, green: 0.957, blue: 0.973)
        // Tinte azul muy suave para acentos sutiles
        static let surfaceTinted = Color(red: 0.945, green: 0.965, blue: 0.992)
        // Borde sutil (#E5E7EB)
        static let border = Color(red: 0.898, green: 0.906, blue: 0.922)
        // Borde con énfasis (#D1D5DB)
        static let borderEmphasis = Color(red: 0.820, green: 0.835, blue: 0.859)

        // Texto principal (#0F172A - slate-900)
        static let textPrimary = Color(red: 0.059, green: 0.090, blue: 0.165)
        // Texto secundario (#475569 - slate-600)
        static let textSecondary = Color(red: 0.278, green: 0.333, blue: 0.412)
        // Texto terciario (#94A3B8 - slate-400)
        static let textTertiary = Color(red: 0.580, green: 0.639, blue: 0.722)
        // Texto muy apagado (#CBD5E1 - slate-300)
        static let textQuaternary = Color(red: 0.796, green: 0.835, blue: 0.882)

        // Acento Focus (#2563EB - blue-600). Botones, selección, taps.
        static let focusAccent = Color(red: 0.145, green: 0.388, blue: 0.922)
        static let focusAccentSoft = Color(red: 0.145, green: 0.388, blue: 0.922).opacity(0.10)
        static let focusAccentHover = Color(red: 0.231, green: 0.510, blue: 0.965)

        // Acento Nova (#6366F1 - indigo-500). Sutilmente más violeta para "AI".
        static let novaAccent = Color(red: 0.388, green: 0.400, blue: 0.945)
        static let novaAccentSoft = Color(red: 0.388, green: 0.400, blue: 0.945).opacity(0.10)
        static let novaAccentDeep = Color(red: 0.545, green: 0.361, blue: 0.965) // violet-500 #8B5CF6

        // Estados
        static let success = Color(red: 0.063, green: 0.725, blue: 0.506)   // #10B981 emerald
        static let warning = Color(red: 0.961, green: 0.620, blue: 0.043)   // #F59E0B amber
        static let danger = Color(red: 0.937, green: 0.267, blue: 0.267)    // #EF4444 red

        // Colores de sección (timeline). Cool palette + warm reminder.
        static let sectionFoco = Color(red: 0.145, green: 0.388, blue: 0.922)        // azul focus
        static let sectionReunion = Color(red: 0.388, green: 0.400, blue: 0.945)     // indigo
        static let sectionPersonal = Color(red: 0.024, green: 0.714, blue: 0.831)    // cyan
        static let sectionEstudio = Color(red: 0.545, green: 0.361, blue: 0.965)     // violet
        static let sectionDescanso = Color(red: 0.078, green: 0.722, blue: 0.651)    // teal
        static let sectionReminder = Color(red: 0.961, green: 0.620, blue: 0.043)    // amber

        // Prioridades
        static let priorityHigh = Color(red: 0.863, green: 0.149, blue: 0.149)       // red-600 #DC2626
        static let priorityMedium = Color(red: 0.961, green: 0.620, blue: 0.043)     // amber
        static let priorityLow = Color(red: 0.580, green: 0.639, blue: 0.722)        // slate

        // Sombra principal (azul muy suave, da elevación premium)
        static let cardShadow = Color(red: 0.145, green: 0.180, blue: 0.420).opacity(0.06)
        static let cardShadowStrong = Color(red: 0.145, green: 0.180, blue: 0.420).opacity(0.10)

        // Gradiente Nova (Gemini-style: azul → violeta → azul)
        static let novaGradient = LinearGradient(
            gradient: Gradient(colors: [
                Color(red: 0.145, green: 0.388, blue: 0.922),
                Color(red: 0.545, green: 0.361, blue: 0.965),
                Color(red: 0.024, green: 0.714, blue: 0.831)
            ]),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Typography

    enum Typography {
        static let display = Font.system(size: 36, weight: .bold, design: .default)
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
        static let largeNumber = Font.system(size: 28, weight: .bold).monospacedDigit()
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
        static let bottomBarSafety: CGFloat = 110
    }

    // MARK: - Radius

    enum Radius {
        static let sm: CGFloat = 10
        static let md: CGFloat = 14
        static let lg: CGFloat = 18
        static let xl: CGFloat = 22
        static let xxl: CGFloat = 28
        static let pill: CGFloat = 999
    }

    enum Stroke {
        static let hairline: CGFloat = 0.5
        static let thin: CGFloat = 1
        static let medium: CGFloat = 1.5
    }
}

// MARK: - View helpers

extension View {
    /// Estilo de label seccional en mayúsculas.
    func sectionLabelStyle() -> some View {
        self
            .font(Theme.Typography.captionEmphasized)
            .foregroundStyle(Theme.Colors.textTertiary)
            .textCase(.uppercase)
            .tracking(0.9)
    }

    /// Card blanca con sombra azul suave, base para superficies.
    func focusCard(
        radius: CGFloat = Theme.Radius.lg,
        padding: CGFloat = Theme.Spacing.lg,
        shadow: Bool = true
    ) -> some View {
        self
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
                    .shadow(
                        color: shadow ? Theme.Colors.cardShadow : .clear,
                        radius: 12,
                        x: 0,
                        y: 4
                    )
            )
    }

    /// Sombra de card estándar (sin borde, sin padding).
    func focusCardShadow(strong: Bool = false) -> some View {
        self.shadow(
            color: strong ? Theme.Colors.cardShadowStrong : Theme.Colors.cardShadow,
            radius: strong ? 18 : 12,
            x: 0,
            y: strong ? 6 : 4
        )
    }
}
