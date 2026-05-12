import SwiftUI

/// Paleta y tokens de Focus.
///
/// Estética: light, limpio, azul-acento. Premium / iOS nativo.
///
/// **Family system** — Focus es parte de una familia de productos. Cada app
/// comparte estructura visual (radios, spacing, tipografía, componentes) y
/// varía sólo los acentos de marca:
///
/// - **Focus** → `brandPrimary` = focusAccent (azul cobalto). Identidad:
///   claridad, organización, estructura, calma, control. Foco: calendario,
///   tareas, planificación diaria + Nova.
/// - **Kairos** (futuro) → `brandPrimary` = violeta/púrpura. Identidad:
///   profundidad, estudio, inteligencia. Foco: sesiones de estudio.
/// - **Spark** (futuro) → `brandPrimary` = naranja/dorado. Identidad: energía,
///   impulso, ejecución. Foco: activación, sprints, momentum.
///
/// Todas comparten:
/// - Mismo wordmark / lockup pattern.
/// - Misma estructura de Theme (Colors, Typography, Spacing, Radius).
/// - Misma familia tipográfica (SF Pro / sistema).
/// - Mismas curvas/radios (Theme.Radius).
/// - Misma iconografía base (SF Symbols).
/// - Mismo Nova accent (violeta) — Nova es transversal a la familia.
///
/// Para portar Theme a otra app de la familia, basta con cambiar `focusAccent`
/// → `brandPrimary` específico y los `sectionFoco`/`sectionReunion` semánticos.
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
        // Mantiene la dominancia azul en TODA la app.
        static let focusAccent = Color(red: 0.145, green: 0.388, blue: 0.922)
        static let focusAccentSoft = Color(red: 0.145, green: 0.388, blue: 0.922).opacity(0.10)
        static let focusAccentHover = Color(red: 0.231, green: 0.510, blue: 0.965)

        // Acento Nova — electric purple-indigo (#5B4DFF). El indigo-500
        // anterior (#6366F1) se sentía "típico" y el #4F46FF previo seguía
        // tirando azul puro. Este tono tiene más violeta para que Nova se
        // distinga claramente del azul focus dominante, sin caer en
        // pastel ni en saturación infantil.
        static let novaAccent = Color(red: 0.357, green: 0.302, blue: 1.000)
        static let novaAccentSoft = Color(red: 0.357, green: 0.302, blue: 1.000).opacity(0.12)
        // Violet profundo para acentos secundarios (gradient tail, halos).
        static let novaAccentDeep = Color(red: 0.545, green: 0.298, blue: 0.965)
        // Electric blue muy saturado — sirve como "highlight" en glow,
        // borders activos, dots, etc.
        static let novaElectric = Color(red: 0.220, green: 0.510, blue: 1.000)
        // Halo ambient — usado de fondo en Nova tab/Nova Live para crear
        // atmósfera sutil sin pintar pared violet.
        static let novaHalo = Color(red: 0.357, green: 0.302, blue: 1.000).opacity(0.06)

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

        // Gradiente Nova — predomina AZUL eléctrico (3 paradas azules
        // antes de cualquier violet), con un toque sutil de violeta al
        // final para identidad "AI". Sin cyan ni cambios bruscos —
        // sensación más cohesiva que el gradient anterior, que pegaba
        // de cobalto a cyan saltando por violet en el medio.
        static let novaGradient = LinearGradient(
            gradient: Gradient(stops: [
                .init(color: Color(red: 0.145, green: 0.388, blue: 0.922), location: 0.0),  // focus blue
                .init(color: Color(red: 0.220, green: 0.510, blue: 1.000), location: 0.45), // electric blue
                .init(color: Color(red: 0.310, green: 0.275, blue: 1.000), location: 0.80), // electric indigo
                .init(color: Color(red: 0.482, green: 0.290, blue: 0.965), location: 1.0)   // violet tail
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
