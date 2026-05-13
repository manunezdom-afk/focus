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
        case .calendar:     return "Tu calendario del día"
        case .nova:         return "Nova entiende tus pedidos"
        case .reminderChip: return "Aviso anticipado"
        }
    }

    /// Texto explicativo principal — corto, claro, 1-2 oraciones.
    var body: String {
        switch self {
        case .focusBar:
            return "Nova puede crear eventos, tareas y recordatorios. Probá pedirle algo en español natural."
        case .mic:
            return "Tocá el micrófono y hablá. Cuando termines, el texto queda en la barra para revisar antes de enviar."
        case .calendar:
            return "Acá ves tus bloques del día. Deslizá un bloque hacia la izquierda para borrarlo, o mantenelo presionado para editar."
        case .nova:
            return "Pedile a Nova que ordene tu día, cree tareas o corrija algo que ya agendaste. Entiende lenguaje natural."
        case .reminderChip:
            return "Este bloque tiene un aviso programado antes de empezar. Vas a recibir una notificación a esa hora."
        }
    }

    /// Ejemplo opcional que aparece en cursiva debajo del body. nil para
    /// tips que no necesitan ejemplo.
    var example: String? {
        switch self {
        case .focusBar:     return "«mañana despiértame a las 7 y recuérdame salir a las 8»"
        case .mic:          return nil
        case .calendar:     return nil
        case .nova:         return "«ordená mi día» · «agenda reunión con Juan mañana a las 12»"
        case .reminderChip: return nil
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
    func presentIfNeeded(_ id: CoachMarkID) {
        guard shouldShow(id), presenting == nil else { return }
        presenting = id
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
                // visualmente a qué se refiere el tip.
                Color.black.opacity(0.45)
                    .ignoresSafeArea()
                    .transition(.opacity)
                CoachMarkCard(id: id) {
                    store.dismissCurrent()
                }
                .padding(.horizontal, Theme.Spacing.xl)
                .transition(.scale(scale: 0.92).combined(with: .opacity))
            }
            .animation(.spring(response: 0.42, dampingFraction: 0.82), value: store.presenting)
            .zIndex(1000)
        }
    }
}

/// La card flotante en sí. Diamante de Nova arriba, título, body, ejemplo
/// opcional, botón "Entendido". Diseño: surface + stroke novaAccent, sin
/// parecer alert del sistema.
private struct CoachMarkCard: View {
    let id: CoachMarkID
    let onDismiss: () -> Void

    @State private var diamondPulse: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            // Diamante Nova con glow sutil — identidad de marca.
            ZStack {
                Circle()
                    .strokeBorder(Theme.Colors.novaAccent.opacity(0.45), lineWidth: 2)
                    .frame(width: 48, height: 48)
                    .scaleEffect(diamondPulse ? 1.8 : 1.0)
                    .opacity(diamondPulse ? 0 : 0.9)
                    .animation(
                        .easeOut(duration: 1.6).repeatForever(autoreverses: false),
                        value: diamondPulse
                    )
                Circle()
                    .fill(Theme.Colors.novaGradient)
                    .frame(width: 48, height: 48)
                    .shadow(color: Theme.Colors.novaAccent.opacity(0.55), radius: 14, y: 4)
                NovaSparkMark(size: 20)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, Theme.Spacing.sm)

            VStack(alignment: .leading, spacing: 8) {
                Text(id.title)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)
                Text(id.body)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .lineSpacing(3)
                if let example = id.example {
                    Text(example)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                        .italic()
                        .padding(.top, 4)
                        .padding(.horizontal, Theme.Spacing.sm)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: Theme.Radius.sm, style: .continuous)
                                .fill(Theme.Colors.novaAccentSoft)
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
                        Capsule().fill(Theme.Colors.novaGradient)
                    )
                    .shadow(color: Theme.Colors.novaAccent.opacity(0.45), radius: 10, y: 4)
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
                        .strokeBorder(Theme.Colors.novaAccent.opacity(0.30), lineWidth: 1.2)
                )
        )
        .focusCardShadow()
        .onAppear { diamondPulse = true }
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
