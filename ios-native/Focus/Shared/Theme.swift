import SwiftUI

/// Paleta y tokens de Focus 2.0 — "Precision Etherealism".
///
/// Dirección: convergencia entre la utilidad quirúrgica de Linear/Raycast y
/// el flujo orgánico de la IA (Arc / Apple Intelligence). NO Apple plano,
/// NO neón futurista. Orden mental con límites físicos claros + IA fluida.
///
/// Cambios visuales 2026-05-21 (Theme 2.0):
/// - Canvas L0 más denso (#F1F3F7) para forzar el despegue visual de las
///   cards blancas. El #FAFBFD anterior se confundía con `surface`.
/// - Sombras táctiles más sutiles (opacity 0.04 vs 0.06) — depth real
///   por profundidad de capa, no por sombra agresiva.
/// - Sections con tonos un punto más profundos (teal #0D9488, amber #D97706)
///   para evitar saturación infantil.
/// - Semantic ajustado: success a esmeralda profunda (#059669), danger a
///   rojo más oscuro (#DC2626), nuevo `info` cian (#0891B2).
/// - Nueva escala de superficies L0/L1/L2 + bordes hairline/soft.
/// - Catálogo de gradients con 5 entradas nombradas (FocusDeep, NovaPrism,
///   AmbientCalm, HeroSunset, DangerMelt).
/// - Motion tokens (snap/quick/standard/slow) + Springs (entrance/dismiss/
///   interactive/settle) tokenizados — antes cada vista los definía a mano.
/// - Tracking system separado (Theme.Tracking) para aplicar tracking
///   tipográfico opinado sin romper Font call sites existentes.
///
/// **Backward-compat**: TODOS los call sites previos (`Theme.Colors.focusAccent`,
/// `Theme.Typography.title`, etc.) siguen funcionando. Los nuevos tokens
/// son aditivos. El único cambio que se ve inmediato en TODA la app es
/// `Theme.Colors.background` (de #FAFBFD a #F1F3F7) — intencional.
///
/// Family system: Focus / Kairos (violet) / Spark (orange) comparten
/// estructura. Para portar, basta cambiar `focusAccent` → brand primario.
enum Theme {

    // MARK: - Colors

    enum Colors {
        // MARK: Canvas + superficies (sistema 3-tier)

        /// Lienzo base — el fondo general de pantallas. Theme 2.0 v3: gris
        /// azul-slate denso (#D8E0EC). El #E9EEF7 anterior se sentía pastel
        /// y poco premium en pantalla pequeña — esta versión empuja más al
        /// slate (más saturado, más profundo) para que las cards blancas
        /// queden visiblemente elevadas y la identidad Linear/Arc se
        /// perciba a primera vista. Sigue siendo light mode legible.
        static let background = Color(red: 0.847, green: 0.878, blue: 0.925)  // #D8E0EC
        /// Canvas alias explícito por claridad — mismo valor que background.
        static let canvasL0 = Color(red: 0.847, green: 0.878, blue: 0.925)    // #D8E0EC
        /// Superficie de cards interactivas — blanco puro contra el canvas.
        static let surface = Color.white                                       // #FFFFFF
        /// Alias semántico de surface.
        static let surfaceL1 = Color.white                                     // #FFFFFF
        /// Superficie elevada para sheets / modals / dropdowns.
        static let surfaceElevated = Color.white                               // #FFFFFF
        /// Hover/pressed / sub-superficie. Antes #F2F4F8, ahora un punto
        /// más cálido para diferenciarse del canvas.
        static let surfaceHigh = Color(red: 0.973, green: 0.980, blue: 0.988)  // #F8FAFC
        /// Alias semántico de surfaceHigh.
        static let surfaceL2 = Color(red: 0.973, green: 0.980, blue: 0.988)    // #F8FAFC
        /// Tinte azul muy suave para acentos sutiles (tomorrow preview, etc).
        static let surfaceTinted = Color(red: 0.937, green: 0.965, blue: 0.996) // #EFF6FE-ish

        // MARK: Bordes (sistema hairline/soft/emphasis)

        /// Border principal — antes #E5E7EB sólido. Ahora derivado de slate-900
        /// con opacity bajísima para que se mezcle con el canvas.
        static let border = Color(red: 0.06, green: 0.09, blue: 0.16).opacity(0.08)
        /// Border con énfasis (focus, hover, selección).
        static let borderEmphasis = Color(red: 0.06, green: 0.09, blue: 0.16).opacity(0.18)
        /// Hairline puro 0.06 para divisiones casi imperceptibles.
        static let borderHairline = Color(red: 0.06, green: 0.09, blue: 0.16).opacity(0.06)
        /// Soft border 0.12 para containers que necesitan presencia leve.
        static let borderSoft = Color(red: 0.06, green: 0.09, blue: 0.16).opacity(0.12)

        // MARK: Texto (4 niveles, sin cambios mayores)

        /// Texto principal (#0F172A - slate-900).
        static let textPrimary = Color(red: 0.059, green: 0.090, blue: 0.165)
        /// Texto secundario (#475569 - slate-600).
        static let textSecondary = Color(red: 0.278, green: 0.333, blue: 0.412)
        /// Texto terciario (#94A3B8 - slate-400).
        static let textTertiary = Color(red: 0.580, green: 0.639, blue: 0.722)
        /// Texto muy apagado (#CBD5E1 - slate-300).
        static let textQuaternary = Color(red: 0.796, green: 0.835, blue: 0.882)

        // MARK: Marca Focus (cobalto)

        /// Acento Focus base — #2563EB blue-600. Botones, selección, taps.
        static let focusAccent = Color(red: 0.145, green: 0.388, blue: 0.922)
        /// Soft Focus #EFF6FF — fondo sutil para focusAccent (botones secundarios,
        /// chips selected, etc). 2026-05-21: cambiado de opacity 0.10 a hex sólido
        /// para consistencia con la paleta de Gemini.
        static let focusAccentSoft = Color(red: 0.937, green: 0.965, blue: 1.000)
        /// Hover/pressed — antes #3B82F6 brighter, ahora #1D4ED8 deeper para
        /// dar sensación de "presionar hacia abajo" (depth táctil).
        static let focusAccentHover = Color(red: 0.114, green: 0.306, blue: 0.847)

        // MARK: Marca Nova (violeta electric)

        /// Nova base — #5B4DFF electric purple-indigo. Identidad propia,
        /// se distingue claramente del cobalto Focus.
        static let novaAccent = Color(red: 0.357, green: 0.302, blue: 1.000)
        /// Soft Nova #EEF2FF — fondo sutil para novaAccent.
        static let novaAccentSoft = Color(red: 0.933, green: 0.949, blue: 1.000)
        /// Violet profundo #4F46FF para acentos secundarios.
        static let novaAccentDeep = Color(red: 0.310, green: 0.275, blue: 1.000)
        /// Electric blue muy saturado #3884FF — highlight en glow, borders activos.
        static let novaElectric = Color(red: 0.220, green: 0.518, blue: 1.000)
        /// Halo ambient — usado de fondo en Nova tab / Nova Live para crear
        /// atmósfera sutil sin pintar pared violeta.
        static let novaHalo = Color(red: 0.357, green: 0.302, blue: 1.000).opacity(0.06)

        // MARK: Estados semánticos

        /// Success — emerald profundo. Antes #10B981 brighter.
        static let success = Color(red: 0.024, green: 0.588, blue: 0.412)        // #059669
        /// Success soft background.
        static let successSoft = Color(red: 0.941, green: 0.992, blue: 0.957)    // #F0FDF4
        /// Warning amber.
        static let warning = Color(red: 0.851, green: 0.467, blue: 0.024)        // #D97706
        /// Warning soft.
        static let warningSoft = Color(red: 0.996, green: 0.949, blue: 0.780)    // #FEF3C7
        /// Danger red más profundo. Antes #EF4444 brighter.
        static let danger = Color(red: 0.863, green: 0.149, blue: 0.149)         // #DC2626
        /// Danger soft.
        static let dangerSoft = Color(red: 0.996, green: 0.949, blue: 0.949)     // #FEF2F2
        /// Info cian — nuevo en 2.0 para mensajes informativos (Mente Clara).
        static let info = Color(red: 0.035, green: 0.569, blue: 0.698)           // #0891B2
        /// Info soft.
        static let infoSoft = Color(red: 0.925, green: 0.996, blue: 1.000)       // #ECFEFF

        // MARK: Colores de sección (timeline)

        /// Foco — azul cobalto, identidad principal.
        static let sectionFoco = Color(red: 0.145, green: 0.388, blue: 0.922)    // #2563EB
        /// Reunión — indigo.
        static let sectionReunion = Color(red: 0.388, green: 0.400, blue: 0.945) // #6366F1
        /// Personal — cyan.
        static let sectionPersonal = Color(red: 0.024, green: 0.714, blue: 0.831) // #06B6D4
        /// Estudio — violet.
        static let sectionEstudio = Color(red: 0.545, green: 0.361, blue: 0.965)  // #8B5CF6
        /// Descanso — teal PROFUNDO. Antes #14B8A6 brighter.
        static let sectionDescanso = Color(red: 0.051, green: 0.580, blue: 0.533) // #0D9488
        /// Reminder — amber OSCURO. Antes #F59E0B brighter.
        static let sectionReminder = Color(red: 0.851, green: 0.467, blue: 0.024) // #D97706

        // MARK: Prioridades (sin cambios mayores)

        static let priorityHigh = Color(red: 0.863, green: 0.149, blue: 0.149)   // #DC2626
        static let priorityMedium = Color(red: 0.851, green: 0.467, blue: 0.024) // #D97706
        static let priorityLow = Color(red: 0.580, green: 0.639, blue: 0.722)    // slate

        // MARK: Sombras táctiles (más sutiles en 2.0)

        /// Sombra de card estándar — Theme 2.0 v3: subo opacity de 0.04 a
        /// 0.10 ahora que el canvas es más profundo (#D8E0EC). Necesita
        /// sombra más visible para que las cards blancas tengan despegue
        /// real. Antes con canvas casi-blanco 0.04 alcanzaba; ahora no.
        static let cardShadow = Color(red: 0.06, green: 0.07, blue: 0.10).opacity(0.10)
        /// Sombra fuerte para elementos elevados (Z-2).
        static let cardShadowStrong = Color(red: 0.06, green: 0.07, blue: 0.10).opacity(0.16)
        /// Sombra para modals / sheets (Z-3).
        static let modalShadow = Color(red: 0.06, green: 0.07, blue: 0.10).opacity(0.22)

        // MARK: Gradients catálogo (Theme 2.0)

        /// FocusDeep — gradient principal de la marca. Cobalto → cobalto pressed.
        /// Usar en botones primary, indicadores activos.
        static let focusDeepGradient = LinearGradient(
            gradient: Gradient(stops: [
                .init(color: Color(red: 0.145, green: 0.388, blue: 0.922), location: 0.0),   // #2563EB
                .init(color: Color(red: 0.114, green: 0.306, blue: 0.847), location: 1.0),   // #1D4ED8
            ]),
            startPoint: UnitPoint(x: 0.0, y: 0.0),
            endPoint: UnitPoint(x: 0.71, y: 0.71)  // ~135°
        )

        /// NovaPrism — gradient multitonal de IA. Violet → electric blue → deep violet.
        /// Usar en diamante Nova, botones AI, cards de IA.
        static let novaPrismGradient = LinearGradient(
            gradient: Gradient(stops: [
                .init(color: Color(red: 0.357, green: 0.302, blue: 1.000), location: 0.00), // #5B4DFF
                .init(color: Color(red: 0.220, green: 0.518, blue: 1.000), location: 0.45), // #3884FF
                .init(color: Color(red: 0.486, green: 0.227, blue: 0.929), location: 1.00), // #7C3AED
            ]),
            startPoint: UnitPoint(x: 0.0, y: 0.0),
            endPoint: UnitPoint(x: 0.71, y: 0.71)
        )

        /// AmbientCalm — radial para hero zones (Mi Día, Nova). Theme 2.0:
        /// SUBE intensidad. Antes era casi imperceptible (8%/3%); ahora
        /// 18%/8% para que el "halo cobalto desde el top" sea claramente
        /// visible cuando se abre Mi Día. Radio 280 → 380 para que
        /// cubra hasta el primer evento del timeline.
        static let ambientCalmRadial = RadialGradient(
            gradient: Gradient(stops: [
                .init(color: Color(red: 0.145, green: 0.388, blue: 0.922).opacity(0.18), location: 0.0),
                .init(color: Color(red: 0.357, green: 0.302, blue: 1.000).opacity(0.08), location: 0.50),
                .init(color: Color(red: 0.913, green: 0.933, blue: 0.969).opacity(0.0),  location: 1.0),
            ]),
            center: .top,
            startRadius: 0,
            endRadius: 380
        )

        /// HeroSunset — gradient tenue para premium cards (focusSoft → novaSoft).
        static let heroSunsetGradient = LinearGradient(
            gradient: Gradient(colors: [
                Color(red: 0.937, green: 0.965, blue: 1.000),  // #EFF6FF
                Color(red: 0.933, green: 0.949, blue: 1.000),  // #EEF2FF
            ]),
            startPoint: .leading,
            endPoint: .trailing
        )

        /// DangerMelt — destrucción / alertas. Rojo → rojo profundo.
        static let dangerMeltGradient = LinearGradient(
            gradient: Gradient(colors: [
                Color(red: 0.937, green: 0.267, blue: 0.267),  // #EF4444
                Color(red: 0.725, green: 0.110, blue: 0.110),  // #B91C1C
            ]),
            startPoint: .top,
            endPoint: .bottom
        )

        /// Nova gradient legacy — preservado para call sites existentes
        /// (FocusBar diamond, Nova tab icon, ExampleBadge, etc.). Usar
        /// `novaPrismGradient` para usos nuevos.
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
    //
    // Mantenemos SF Pro nativo (no embebemos Geist Sans para evitar bundle
    // weight). El carácter "opinado" se logra con tracking agresivo aplicado
    // vía `Theme.Tracking` en cada call site, y con la nueva escala que
    // incluye una variante display (34pt) para hero headers.
    //
    // Reglas de uso:
    // - displayHero → títulos de pantalla únicos (Mi Día, Calendario, etc).
    // - title1     → headers de sección destacados (Hero de Empty State, Onboarding).
    // - title2     → títulos de cards grandes / dialog titles.
    // - title3     → títulos secundarios (settings sections).
    // - headline   → headers de UI controls / labels destacados.
    // - body       → texto de lectura (descripciones, párrafos).
    // - callout    → buttons / badges / tags.
    // - captionMono→ timestamps, metadata, durations.

    enum Typography {
        /// Display hero — pantalla única (34pt SemiBold). Aplicar `.tracking(Theme.Tracking.displayHero)`.
        static let displayHero = Font.system(size: 34, weight: .semibold)
        /// Display extra grande — preservado para call sites legacy. Prefer displayHero.
        static let display = Font.system(size: 36, weight: .bold)
        /// Title legacy 30pt — preservado. Para uso nuevo prefer title1 (24pt).
        static let title = Font.system(size: 30, weight: .bold)
        /// Title 1 — 24pt SemiBold tracking -0.03em.
        static let title1 = Font.system(size: 24, weight: .semibold)
        /// Title 2 — 22pt SemiBold (preservado).
        static let title2 = Font.system(size: 22, weight: .semibold)
        /// Title 3 — 20pt Medium tracking -0.02em (nuevo en 2.0).
        static let title3 = Font.system(size: 20, weight: .medium)
        /// Headline — 17pt SemiBold tracking -0.015em.
        static let headline = Font.system(size: 17, weight: .semibold)
        /// Body — 15pt regular tracking -0.01em.
        static let body = Font.system(size: 15, weight: .regular)
        /// Body emphasized — medium weight.
        static let bodyEmphasized = Font.system(size: 15, weight: .medium)
        /// Body bold — semibold weight para CTAs inline.
        static let bodyBold = Font.system(size: 15, weight: .semibold)
        /// Subhead 13pt regular.
        static let subhead = Font.system(size: 13, weight: .regular)
        /// Subhead emphasized.
        static let subheadEmphasized = Font.system(size: 13, weight: .medium)
        /// Callout — 13pt Medium para botones / badges.
        static let callout = Font.system(size: 13, weight: .medium)
        /// Footnote 12pt medium.
        static let footnote = Font.system(size: 12, weight: .medium)
        /// Caption 11pt medium.
        static let caption = Font.system(size: 11, weight: .medium)
        /// Caption emphasized.
        static let captionEmphasized = Font.system(size: 11, weight: .semibold)
        /// Timestamp legacy (13pt monospaced digit semibold).
        static let timestamp = Font.system(size: 13, weight: .semibold).monospacedDigit()
        /// Large number legacy.
        static let largeNumber = Font.system(size: 28, weight: .bold).monospacedDigit()

        // MARK: Variantes monoespaciadas (Theme 2.0)

        /// Caption mono — 11pt medium SF Mono. Para timestamps, metadata,
        /// badges UPPERCASE. Aplicar `.tracking(Theme.Tracking.captionMono)`.
        static let captionMono = Font.system(size: 11, weight: .medium, design: .monospaced)
        /// Body mono — 13pt medium SF Mono. Para cuentas regresivas, IDs.
        static let bodyMono = Font.system(size: 13, weight: .medium, design: .monospaced)
        /// Display mono — 28pt bold SF Mono. Para countdowns hero / KPIs.
        static let displayMono = Font.system(size: 28, weight: .bold, design: .monospaced)
    }

    // MARK: - Tracking
    //
    // Tracking en puntos (no em). SwiftUI `.tracking()` toma CGFloat.
    // Valores derivados de -0.04em, -0.03em, etc. multiplicados por el font size.
    // Aplicar siempre que se use la variante tipográfica correspondiente.

    enum Tracking {
        /// -0.04em × 34pt = -1.36
        static let displayHero: CGFloat = -1.36
        /// -0.03em × 24pt = -0.72
        static let title1: CGFloat = -0.72
        /// -0.025em × 22pt = -0.55
        static let title2: CGFloat = -0.55
        /// -0.02em × 20pt = -0.40
        static let title3: CGFloat = -0.40
        /// -0.015em × 17pt = -0.255
        static let headline: CGFloat = -0.255
        /// -0.01em × 15pt = -0.15
        static let body: CGFloat = -0.15
        /// 0 — botones/callout neutral
        static let callout: CGFloat = 0
        /// +0.03em × 11pt = +0.33 para UPPERCASE captions
        static let captionMono: CGFloat = 0.33
    }

    // MARK: - Spacing (sin cambios)

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

    // MARK: - Radius (sin cambios)

    enum Radius {
        static let sm: CGFloat = 10
        static let md: CGFloat = 14
        static let lg: CGFloat = 18
        static let xl: CGFloat = 22
        static let xxl: CGFloat = 28
        static let pill: CGFloat = 999
    }

    // MARK: - Stroke

    enum Stroke {
        static let hairline: CGFloat = 0.5
        static let thin: CGFloat = 1
        static let medium: CGFloat = 1.5
    }

    // MARK: - QA diagnostic (temporal)
    //
    // Marca visible para confirmar en device físico que la build instalada
    // contiene el rediseño "Precision Etherealism". Aparece como pill en
    // Mi Día y como row en Ajustes → Acerca. Borrar este enum y sus call
    // sites cuando termine la fase QA del rediseño.

    enum QA {
        static let markerLabel: String = "FOCUS VISUAL 2.0"
        /// Etiqueta del milestone del rediseño. Si el QA en iPhone NO muestra
        /// este string, la build instalada es vieja — purgar derived data
        /// (Xcode → Product → Clean Build Folder) y reinstalar.
        static let buildLabel: String = "qa-2026-05-21-build18"
    }

    // MARK: - Motion (Theme 2.0)
    //
    // Tokens centralizados de animación. Antes cada vista definía durations
    // y curves a mano — esto los unifica. Reglas:
    //
    // - snap     (0.12s) — taps de botón, escala 0.97 al presionar.
    // - quick    (0.24s) easeOut — toggles, cambios de texto rápidos.
    // - standard (0.38s) easeInOut — expansiones, transiciones de tab.
    // - slow     (0.58s) cubicBezier(0.16, 1, 0.3, 1) — chat Nova, cargas.

    enum Motion {
        // Durations en seconds (SwiftUI usa seconds).
        static let snap: Double = 0.12
        static let quick: Double = 0.24
        static let standard: Double = 0.38
        static let slow: Double = 0.58

        // Animations pre-built para uso directo.
        static let easeOutQuick: Animation = .easeOut(duration: quick)
        static let easeInOutStandard: Animation = .easeInOut(duration: standard)
        /// Apple-style overshoot/settle — usar para entrada de elementos hero.
        static let appleSpring: Animation = .timingCurve(0.16, 1, 0.3, 1, duration: slow)
        /// Snap interno — escala/opacity rápida de tap feedback.
        static let snapTap: Animation = .easeInOut(duration: snap)
    }

    // MARK: - Spring (Theme 2.0)
    //
    // Curvas físicas balanceadas. Springs son fundamentales en SwiftUI para
    // sensación táctil. Usar siempre que el cambio implique movimiento
    // (no solo opacidad/color).

    enum Spring {
        /// Entrada de UI (cards apareciendo, sheets, inline responses).
        /// Rebote imperceptible al final para sensación de "asentamiento".
        static let entrance: Animation = .spring(response: 0.38, dampingFraction: 0.68, blendDuration: 0)
        /// Salida de UI (dismiss, swipe-out, cierre de modals).
        /// Extremadamente rápido y amortiguado para "limpiar" pantalla.
        static let dismiss: Animation = .spring(response: 0.28, dampingFraction: 0.88)
        /// Gestos continuos (drag, swipe-to-delete).
        /// Adherido al dedo, retraso cero.
        static let interactive: Animation = .interactiveSpring(response: 0.18, dampingFraction: 0.85)
        /// Settle suave — para cuando algo regresa a su lugar tras una interacción.
        static let settle: Animation = .spring(response: 0.32, dampingFraction: 0.85)
        /// Pop — para badges/notifications que aparecen con micro-overshoot.
        static let pop: Animation = .spring(response: 0.30, dampingFraction: 0.55)
    }
}

// MARK: - View helpers

extension View {

    // MARK: Sección label

    /// Estilo de label seccional en mayúsculas con tracking opinado.
    /// Usa caption emphasized + textTertiary + UPPERCASE + tracking 0.9.
    func sectionLabelStyle() -> some View {
        self
            .font(Theme.Typography.captionEmphasized)
            .foregroundStyle(Theme.Colors.textTertiary)
            .textCase(.uppercase)
            .tracking(0.9)
    }

    // MARK: Cards (sistema 2.0)

    /// Card estándar (Z-1) — blanco puro + hairline + sombra fina.
    /// Reemplaza la versión 1.0 que usaba sombra 0.06; ahora 0.04 para
    /// dejar que la profundidad venga del canvas L0 / surface contrast.
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
                            .strokeBorder(Theme.Colors.borderHairline, lineWidth: Theme.Stroke.hairline)
                    )
                    .shadow(
                        color: shadow ? Theme.Colors.cardShadow : .clear,
                        radius: 6,
                        x: 0,
                        y: 3
                    )
            )
    }

    /// Card elevada (Z-2) — usa material .ultraThinMaterial + sombra media.
    /// Para componentes flotantes (tab bar, FocusBar inline, dropdowns).
    func focusCardElevated(
        radius: CGFloat = Theme.Radius.xl,
        padding: CGFloat = Theme.Spacing.lg,
        tint: Color? = nil
    ) -> some View {
        self
            .padding(padding)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(.ultraThinMaterial)
                    if let tint {
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .fill(tint.opacity(0.05))
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .strokeBorder(Theme.Colors.borderHairline, lineWidth: Theme.Stroke.hairline)
                )
                .shadow(color: Theme.Colors.cardShadowStrong, radius: 16, x: 0, y: 8)
            )
    }

    /// Card destacada (Z-1 con énfasis IA) — tinte Nova soft + borde gradient.
    /// Para NovaSuggestionCard, AI result cards, premium account card.
    func novaResultCard(
        radius: CGFloat = Theme.Radius.xl,
        padding: CGFloat = Theme.Spacing.xl
    ) -> some View {
        self
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(Theme.Colors.novaAccentSoft)
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .strokeBorder(Theme.Colors.novaPrismGradient, lineWidth: 1.5)
                    )
                    .shadow(color: Theme.Colors.cardShadow, radius: 8, x: 0, y: 4)
            )
    }

    // MARK: Shadow shorthand

    /// Sombra de card estándar (sin borde, sin padding). Versión 2.0:
    /// más sutil — depth real viene del sistema de capas, no del shadow.
    func focusCardShadow(strong: Bool = false) -> some View {
        self.shadow(
            color: strong ? Theme.Colors.cardShadowStrong : Theme.Colors.cardShadow,
            radius: strong ? 16 : 6,
            x: 0,
            y: strong ? 8 : 3
        )
    }
}
