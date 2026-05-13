import SwiftUI

/// Identificador de cada coach mark contextual. Cada uno se muestra UNA
/// vez por dispositivo y luego no vuelve a aparecer hasta que el usuario
/// resetea los tutoriales desde Ajustes.
///
/// El `rawValue` se usa como sufijo en la key `@AppStorage("focus.v1.coach.<id>")`.
enum CoachMarkID: String, CaseIterable {
    case focusBar       = "focusBar"
    case mic            = "mic"
    case calendar       = "calendar"
    case nova           = "nova"
    case reminderChip   = "reminderChip"

    /// Texto del titular de la card.
    var title: String {
        switch self {
        case .focusBar:     return "Escribe como hablas"
        case .mic:          return "Dictar a Nova"
        case .calendar:     return "Tu día, de un vistazo"
        case .nova:         return "Nova te entiende"
        case .reminderChip: return "Aviso anticipado"
        }
    }

    /// Texto explicativo principal — corto, claro, 1-2 oraciones.
    var body: String {
        switch self {
        case .focusBar:
            return "Escríbele a Nova como si hablaras. Puede crear eventos, tareas y recordatorios."
        case .mic:
            return "Toca el micrófono y habla. El texto queda escrito para que lo revises antes de enviar."
        case .calendar:
            return "Desliza un bloque a la izquierda para borrarlo o tócalo y mantén presionado para editar."
        case .nova:
            return "Pídele organizar tu día, crear tareas o corregir algo que ya agendaste. Entiende lenguaje natural."
        case .reminderChip:
            return "Vas a recibir una notificación antes de la hora de inicio."
        }
    }

    /// Ejemplo opcional que aparece en cursiva debajo del body. nil para
    /// tips que no necesitan ejemplo.
    var example: String? {
        switch self {
        case .focusBar:     return "«mañana despiértame a las 7 y recuérdame salir a las 8»"
        case .mic:          return nil
        case .calendar:     return nil
        case .nova:         return "«organiza mi día» · «agenda reunión con Juan mañana a las 12»"
        case .reminderChip: return nil
        }
    }

    /// SF Symbol que se muestra en la cabecera de la card. Cada tip tiene
    /// uno distinto para que las cards no se sientan idénticas — visual
    /// inmediato del feature al que se refiere el tip.
    var glyph: String {
        switch self {
        case .focusBar:     return "text.bubble.fill"
        case .mic:          return "mic.fill"
        case .calendar:     return "calendar"
        case .nova:         return "sparkles"
        case .reminderChip: return "bell.badge.fill"
        }
    }

    /// Color de marca de cada tip. Diferencia visualmente los coach marks
    /// y se usa también en el botón "Entendido" para reforzar la identidad.
    var accent: Color {
        switch self {
        case .focusBar:     return Theme.Colors.focusAccent
        case .mic:          return Theme.Colors.focusAccent
        case .calendar:     return Theme.Colors.sectionReunion
        case .nova:         return Theme.Colors.novaAccent
        case .reminderChip: return Theme.Colors.warning
        }
    }
}

/// Store de flags de coach marks. Lee/escribe directo a `UserDefaults` con
/// prefix `focus.v1.coach.*` — el mismo formato que el resto del store
/// versionado. Permite resetear todos los tips desde Ajustes.
@MainActor
final class CoachMarksStore: ObservableObject {
    /// ID del coach mark que se debe mostrar AHORA, si alguno. Cuando es
    /// no-nil, `CoachMarkOverlay` renderiza la card flotante.
    @Published var presenting: CoachMarkID? = nil

    private static let prefix = "focus.v1.coach."

    /// True si el coach mark con `id` aún NO se ha mostrado al usuario.
    func shouldShow(_ id: CoachMarkID) -> Bool {
        !UserDefaults.standard.bool(forKey: Self.prefix + id.rawValue)
    }

    /// Marca el coach mark como visto — no volverá a aparecer hasta reset.
    func markSeen(_ id: CoachMarkID) {
        UserDefaults.standard.set(true, forKey: Self.prefix + id.rawValue)
    }

    /// Pide mostrar el coach mark si todavía no se vio. Idempotente.
    /// Añade un pequeño delay para que el tip no aparezca al mismo tiempo
    /// que la vista todavía está armando su layout — eso se sentía brusco.
    func presentIfNeeded(_ id: CoachMarkID) {
        guard shouldShow(id), presenting == nil else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) { [weak self] in
            guard let self else { return }
            guard self.shouldShow(id), self.presenting == nil else { return }
            self.presenting = id
        }
    }

    /// Cierra el coach mark visible y lo marca como visto.
    func dismissCurrent() {
        guard let id = presenting else { return }
        markSeen(id)
        presenting = nil
    }

    /// Resetea TODOS los flags — todos los tips volverán a aparecer. Lo
    /// dispara el usuario desde Ajustes → "Ver tutoriales otra vez".
    func resetAll() {
        for id in CoachMarkID.allCases {
            UserDefaults.standard.removeObject(forKey: Self.prefix + id.rawValue)
        }
        presenting = nil
    }
}

/// Overlay modal con la card del coach mark. Se monta como `.overlay` en
/// la vista raíz que tenga el `CoachMarksStore` en environment.
struct CoachMarkOverlay: View {
    @ObservedObject var store: CoachMarksStore

    var body: some View {
        if let id = store.presenting {
            ZStack {
                // Backdrop oscuro semi-transparente — atenúa la UI detrás
                // sin tapar completamente para que el usuario ubique
                // visualmente a qué se refiere el tip. Tap fuera para
                // cerrar — patrón estándar iOS.
                Color.black.opacity(0.40)
                    .ignoresSafeArea()
                    .contentShape(Rectangle())
                    .onTapGesture {
                        store.dismissCurrent()
                    }
                    .transition(.opacity)
                CoachMarkCard(id: id) {
                    store.dismissCurrent()
                }
                .padding(.horizontal, Theme.Spacing.xl)
                .transition(
                    .asymmetric(
                        insertion: .scale(scale: 0.88)
                            .combined(with: .opacity)
                            .combined(with: .move(edge: .bottom)),
                        removal: .scale(scale: 0.94)
                            .combined(with: .opacity)
                    )
                )
            }
            // Spring más suave (response 0.55 vs 0.42 antes) + damping
            // un toque más bajo para que sienta vida sin rebotar. Combinado
            // con la animación de offset desde abajo, la entrada deja de
            // sentirse "brusca" y se parece más a un sheet de iOS.
            .animation(.spring(response: 0.55, dampingFraction: 0.82), value: store.presenting)
            .zIndex(1000)
        }
    }
}

/// La card flotante en sí. Cabecera con glyph + halo del color de tip,
/// título, body, ejemplo opcional, botón "Entendido" del color del tip.
/// Diseño: surface + stroke acento, sin parecer alert del sistema.
private struct CoachMarkCard: View {
    let id: CoachMarkID
    let onDismiss: () -> Void

    @State private var iconAppeared: Bool = false
    @State private var haloPulse: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            header
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.top, Theme.Spacing.sm)

            VStack(alignment: .leading, spacing: 8) {
                Text(id.title)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)
                Text(id.body)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .lineSpacing(3)
                if let example = id.example {
                    Text(example)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(id.accent)
                        .italic()
                        .padding(.top, 4)
                        .padding(.horizontal, Theme.Spacing.sm + 2)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: Theme.Radius.sm, style: .continuous)
                                .fill(id.accent.opacity(0.10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: Theme.Radius.sm, style: .continuous)
                                        .strokeBorder(id.accent.opacity(0.20), lineWidth: 1)
                                )
                        )
                }
            }

            Button(action: onDismiss) {
                Text("Entendido")
                    .font(Theme.Typography.bodyBold)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.md - 2)
                    .background(
                        Capsule().fill(buttonFill)
                    )
                    .shadow(color: id.accent.opacity(0.40), radius: 12, y: 5)
            }
            .buttonStyle(.plain)
            .padding(.top, Theme.Spacing.xs)
        }
        .padding(Theme.Spacing.lg)
        .frame(maxWidth: 360)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .strokeBorder(id.accent.opacity(0.28), lineWidth: 1.2)
                )
        )
        .focusCardShadow(strong: true)
        .onAppear {
            // Stagger sutil: el icono entra con un leve delay después de
            // la card. Hace que el coach mark "se arme" en vez de aparecer
            // todo a la vez, eliminando la sensación brusca.
            withAnimation(.spring(response: 0.45, dampingFraction: 0.7).delay(0.08)) {
                iconAppeared = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                haloPulse = true
            }
        }
    }

    /// Header visual de la card. Para Nova mantenemos el diamante de marca;
    /// para el resto, un glyph circular del color del tip — así cada
    /// tutorial se siente distinto, no una secuencia de cards idénticas.
    @ViewBuilder
    private var header: some View {
        ZStack {
            // Halo expansivo del color del tip — pulsa sutil mientras la
            // card está visible para atraer el ojo al icono.
            Circle()
                .strokeBorder(id.accent.opacity(0.40), lineWidth: 2)
                .frame(width: 56, height: 56)
                .scaleEffect(haloPulse ? 1.9 : 1.0)
                .opacity(haloPulse ? 0 : 0.85)
                .animation(
                    .easeOut(duration: 1.8).repeatForever(autoreverses: false),
                    value: haloPulse
                )

            if id == .nova {
                // Nova mantiene su identidad: diamante con gradient.
                Circle()
                    .fill(Theme.Colors.novaGradient)
                    .frame(width: 56, height: 56)
                    .shadow(color: Theme.Colors.novaAccent.opacity(0.55), radius: 14, y: 5)
                NovaSparkMark(size: 24)
            } else {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                id.accent,
                                id.accent.opacity(0.78)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 56, height: 56)
                    .shadow(color: id.accent.opacity(0.45), radius: 14, y: 5)
                Image(systemName: id.glyph)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .scaleEffect(iconAppeared ? 1.0 : 0.6)
        .opacity(iconAppeared ? 1.0 : 0.0)
    }

    /// Fill del botón "Entendido". Nova sigue con su gradient característico;
    /// el resto usa el accent del tip plano para reforzar la identidad
    /// visual sin parecer "todos iguales con CTA violeta".
    private var buttonFill: AnyShapeStyle {
        if id == .nova {
            return AnyShapeStyle(Theme.Colors.novaGradient)
        }
        return AnyShapeStyle(
            LinearGradient(
                colors: [id.accent, id.accent.opacity(0.85)],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
    }
}

/// Modifier que dispara `presentIfNeeded(id)` cuando un trigger cambia.
/// Útil para tips que se disparan al entrar a una vista (`.onAppear`) o
/// al primer tap del usuario en un elemento (`.onChange(of: tapCount)`).
extension View {
    /// Dispara el coach mark `id` solo la primera vez que `trigger` cambia
    /// (de su valor inicial). Util para "entrar a una tab" (onAppear) o
    /// "primer tap" (onChange).
    func coachMarkOnAppear(_ id: CoachMarkID, store: CoachMarksStore) -> some View {
        self.onAppear {
            store.presentIfNeeded(id)
        }
    }
}
