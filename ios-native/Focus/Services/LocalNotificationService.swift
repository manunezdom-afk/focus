import Foundation
import UserNotifications

/// Servicio de notificaciones LOCALES (UserNotifications framework).
///
/// Programa avisos puntuales en el iPhone para `FocusEvent` que sean
/// recordatorios (`isReminder == true`). NO usa APNs remoto, NO requiere
/// servidor, NO requiere entitlements especiales.
///
/// Reglas:
/// - Identifier estable por evento: `focus-reminder-event-<UUID>`. Si se
///   re-llama `schedule(for:)` con el mismo id, iOS reemplaza la pendiente.
/// - No programa si el evento ya pasó (iOS lo ignoraría igual, pero
///   evitamos llenar el log).
/// - No programa si el toggle `remindersEnabled` está apagado.
/// - `cancel(for:)` borra silenciosamente — si no existía, no crashea.
/// - `requestAuthorization()` pide permiso una sola vez (iOS recuerda la
///   decisión); si ya está concedido, devuelve `.authorized` inmediato.
///
/// Privacidad: el contenido de la notificación incluye el título del
/// evento + ubicación si la tiene. No incluye `id`, no incluye tokens,
/// no incluye datos sensibles. El cuerpo cumple con la regla del usuario
/// de mensajes cortos y útiles.
final class LocalNotificationService: NSObject, UNUserNotificationCenterDelegate {

    static let shared = LocalNotificationService()

    private override init() {
        super.init()
        // Registramos self como delegate ANTES de que llegue ninguna
        // notificación. Sin delegate, iOS suprime el banner cuando la app
        // está en foreground — el usuario crearía un recordatorio, lo
        // dejaría arriba y la notif nunca se vería.
        //
        // El delegate se accede vía singleton: al primer touch de
        // `LocalNotificationService.shared` (boot bootstrap, Ajustes,
        // addEvent), iOS recibe el binding.
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Identifier convention

    /// Prefijo para identificar notificaciones de recordatorios de eventos.
    /// Permite cancelarlas en grupo si fuera necesario y distinguirlas de
    /// futuras notificaciones (resumen diario, etc.) que usen otros prefijos.
    private static let eventReminderPrefix = "focus-reminder-event-"

    static func identifier(for eventId: UUID) -> String {
        eventReminderPrefix + eventId.uuidString
    }

    // MARK: - Authorization

    /// Pide permiso al usuario (alert/badge/sound). Si ya está autorizado,
    /// devuelve `.authorized` inmediato sin mostrar prompt.
    ///
    /// `provisional: false` — pedimos permiso explícito porque queremos
    /// que la notificación realmente alerte al usuario (no entrega
    /// silenciosa). Si el usuario rechaza, `currentStatus()` devolverá
    /// `.denied` y el caller mostrará un mensaje.
    @discardableResult
    func requestAuthorization() async -> UNAuthorizationStatus {
        let center = UNUserNotificationCenter.current()
        let current = await center.notificationSettings().authorizationStatus
        // Si ya hay decisión, respetamos. iOS no muestra prompt dos veces.
        if current != .notDetermined {
            return current
        }
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            return granted ? .authorized : .denied
        } catch {
            // El request falló por una razón rara (raro). Tratamos como denied.
            return .denied
        }
    }

    /// Estado actual del permiso. No bloquea ni dispara prompt.
    func currentStatus() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    // MARK: - Scheduling

    /// Programa una notificación local para el evento si:
    /// - es recordatorio (`isReminder == true`),
    /// - su `startTime` está en el futuro,
    /// - el toggle global lo permite (lo chequea el caller),
    /// - el permiso está concedido (lo chequea el caller).
    ///
    /// Idempotente: usar la misma id reemplaza la pendiente anterior, así
    /// que es seguro llamarla varias veces (por ejemplo en `mergeRemoteEvents`).
    func scheduleReminder(for event: FocusEvent) async {
        guard event.isReminder == true else {
            // No es recordatorio puntual → no programamos. Si pasó de ser
            // recordatorio a evento normal, el caller debe llamar cancel.
            return
        }
        guard event.startTime > Date() else {
            // Fecha ya pasó — iOS la rechazaría. Nos saltamos para no
            // ensuciar logs.
            return
        }

        let center = UNUserNotificationCenter.current()
        let content = UNMutableNotificationContent()
        // Title fijo "Focus" para que el usuario reconozca rápido la fuente.
        // El detalle real va en el body para que iOS lo muestre prominente.
        content.title = "Focus"
        // Subtitle "Recordatorio" agrega contexto sin saturar.
        content.subtitle = "Recordatorio"
        if let location = event.location?.trimmingCharacters(in: .whitespacesAndNewlines),
           !location.isEmpty {
            content.body = "\(event.title) · \(location)"
        } else {
            content.body = event.title
        }
        content.sound = .default
        // userInfo permite que el handler de tap sepa qué evento abrir.
        // Se sanitiza al string (UUID) — no metemos el FocusEvent completo.
        content.userInfo = ["eventId": event.id.uuidString]

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: event.startTime
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(
            identifier: Self.identifier(for: event.id),
            content: content,
            trigger: trigger
        )

        do {
            try await center.add(request)
        } catch {
            // Si add falla (ej. cuota llena, permiso revocado entre el
            // chequeo y el call), no hay manera limpia de avisarle al
            // usuario en este punto. Loggeamos sin datos sensibles.
            print("[LocalNotificationService] schedule failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Cancellation

    /// Cancela una notificación pendiente. Silencioso si no existía.
    func cancelReminder(eventId: UUID) {
        let identifier = Self.identifier(for: eventId)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }

    /// Limpia TODAS las notificaciones de recordatorio (las que comienzan
    /// con `focus-reminder-event-`). Útil para "Reset local" en Ajustes y
    /// para signOut. NO toca otras notificaciones del sistema.
    func cancelAllReminders() async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let ourIds = pending
            .map(\.identifier)
            .filter { $0.hasPrefix(Self.eventReminderPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: ourIds)
    }

    // MARK: - Debug

    /// Devuelve count de notificaciones pendientes propias. Solo para
    /// debugging interno o sección Ajustes "estado". No expone contenido.
    func pendingReminderCount() async -> Int {
        let pending = await UNUserNotificationCenter.current().pendingNotificationRequests()
        return pending.filter { $0.identifier.hasPrefix(Self.eventReminderPrefix) }.count
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Llamado por iOS cuando una notif está por entregarse y la app está
    /// en FOREGROUND. Sin esto, iOS suprime el banner — el usuario nunca
    /// vería la notificación si justo tiene la app abierta.
    ///
    /// Configuración V1: mostramos `banner` (alerta arriba), `sound`
    /// (default) y agregamos a la `list` del Notification Center. No
    /// usamos `badge` para no llenar el icon de la app con un número
    /// que el usuario no podría limpiar fácilmente.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }

    /// Llamado por iOS cuando el usuario interactúa con la notificación
    /// (tap, swipe). En V1 no hacemos deep routing — la app abre en su
    /// último estado. El `eventId` queda disponible en `userInfo` para una
    /// futura implementación de "navegar al item específico".
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // No-op V1. iOS ya abre la app por default.
        completionHandler()
    }
}
