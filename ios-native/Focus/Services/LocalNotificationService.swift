import Foundation
import UserNotifications

extension Notification.Name {
    /// Disparado cuando el usuario toca una notificación local de Focus
    /// (recordatorio puntual o aviso de evento). `userInfo["eventId"]`
    /// contiene el UUID del evento como String. La UI escucha esto para
    /// saltar a la tab Mi Día.
    static let focusReminderTapped = Notification.Name("focus.reminder.tapped")
}

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
    /// - es recordatorio puntual (`isReminder == true`), **O**
    /// - tiene `reminderOffsets` configurados (≥ 1 offset) — caso típico:
    ///   evento regular tipo "Ducharme 10:00" al que el usuario le pegó
    ///   un aviso de "10 min antes" → `reminderOffsets=[10]`, isReminder
    ///   sigue false porque el evento en sí no es un compromiso de aviso.
    ///   El usuario igual quiere recibir la notif a las 09:50.
    /// - su `startTime` está en el futuro,
    /// - el toggle global lo permite (lo chequea el caller),
    /// - el permiso está concedido (lo chequea el caller).
    ///
    /// Idempotente: usar la misma id reemplaza la pendiente anterior, así
    /// que es seguro llamarla varias veces (por ejemplo en `mergeRemoteEvents`).
    func scheduleReminder(for event: FocusEvent) async {
        let isReminderEvent = event.isReminder == true
        let hasOffsets = !(event.reminderOffsets?.isEmpty ?? true)
        guard isReminderEvent || hasOffsets else {
            // Ni recordatorio puntual ni con offsets → no programamos.
            // El caller (FocusDataStore.syncLocalNotification) garantiza
            // que cualquier pendiente previa se cancela.
            return
        }
        guard event.startTime > Date() else {
            // Fecha ya pasó — iOS la rechazaría. Nos saltamos para no
            // ensuciar logs.
            return
        }

        // Antes de programar la nueva, cancelamos cualquier pendiente de
        // este evento (puede haber múltiples si tiene varios offsets).
        cancelReminder(eventId: event.id)

        // Agrupamos por fireDate: cuando hay sub-recordatorios vinculados
        // ("salir 20 min antes" + "llevar zapatos" comparten offset=20), ambos
        // generan la MISMA fireDate y queremos UNA sola notif con body
        // combinado, no spam de 2 notifs idénticas. Cada grupo lleva su
        // colección de notas (en infinitivo) que el body convierte a
        // imperativo.
        let groups = groupedFireDates(for: event)
        guard !groups.isEmpty else { return }

        let center = UNUserNotificationCenter.current()
        let cleanTitle = event.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let eventTitle = cleanTitle.isEmpty ? "Focus" : cleanTitle
        let displayTitle = notificationTitle(eventTitle: eventTitle, eventStart: event.startTime)

        for (index, group) in groups.enumerated() {
            let content = UNMutableNotificationContent()
            // Regla del usuario (2026-05-20):
            //   title = "<evento> a las HH:mm"  ← contexto primero
            //   body  = acciones concretas en imperativo, separadas por ". "
            // Si no hay notas custom, body = ubicación (legacy) o vacío.
            content.title = displayTitle
            let imperatives = group.notes
                .map { toImperative($0, fireDate: group.fireDate, eventStart: event.startTime) }
                .filter { !$0.isEmpty }
            if !imperatives.isEmpty {
                content.body = imperatives.joined(separator: " ")
                content.subtitle = ""
            } else if let location = event.location?.trimmingCharacters(in: .whitespacesAndNewlines),
                      !location.isEmpty {
                content.subtitle = subtitle(forFireDate: group.fireDate, eventStart: event.startTime)
                content.body = location
            } else {
                content.subtitle = subtitle(forFireDate: group.fireDate, eventStart: event.startTime)
                content.body = ""
            }
            content.sound = .default
            content.userInfo = ["eventId": event.id.uuidString]

            let components = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: group.fireDate
            )
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

            // Identifier por grupo. El primer (único) grupo usa el id base
            // para mantener cancelReminder() compatible con eventos legacy.
            let identifier = groups.count == 1
                ? Self.identifier(for: event.id)
                : "\(Self.identifier(for: event.id))-\(index)"

            let request = UNNotificationRequest(
                identifier: identifier,
                content: content,
                trigger: trigger
            )

            do {
                try await center.add(request)
            } catch {
                print("[LocalNotificationService] schedule failed: \(error.localizedDescription)")
            }
        }
    }

    /// Una notificación a disparar: fecha y todas las notas (infinitivo) que
    /// caen en esa misma fecha. Cuando varios `reminderOffsets[i]` resultan
    /// en el mismo fireDate (caso típico: "salir 20 min antes" + "llevar
    /// zapatos" con offsets [20, 20]), las notas se acumulan en un solo
    /// grupo para evitar spam.
    private struct FireGroup {
        let fireDate: Date
        var notes: [String]
    }

    /// Construye los grupos de notif a partir del evento. Aplica los offsets,
    /// filtra los pasados, agrupa por fireDate idénticos, ordena cronológico.
    private func groupedFireDates(for event: FocusEvent) -> [FireGroup] {
        let now = Date()
        let offsets = event.reminderOffsets ?? []
        if offsets.isEmpty {
            guard event.startTime > now else { return [] }
            return [FireGroup(fireDate: event.startTime, notes: [])]
        }
        var byDate: [Date: FireGroup] = [:]
        for (idx, off) in offsets.enumerated() {
            let fireDate = event.startTime.addingTimeInterval(-Double(off) * 60)
            guard fireDate > now else { continue }
            let note = event.reminderNote(at: idx)
            if var existing = byDate[fireDate] {
                if let n = note { existing.notes.append(n) }
                byDate[fireDate] = existing
            } else {
                byDate[fireDate] = FireGroup(fireDate: fireDate, notes: note.map { [$0] } ?? [])
            }
        }
        return byDate.values.sorted { $0.fireDate < $1.fireDate }
    }

    /// Genera el title oficial de la notif: "{evento} a las HH:mm". El usuario
    /// quiere ver el evento padre + cuándo ocurre, no la nota suelta.
    private func notificationTitle(eventTitle: String, eventStart: Date) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "es_CL")
        fmt.dateFormat = "HH:mm"
        return "\(eventTitle) a las \(fmt.string(from: eventStart))"
    }

    /// Convierte un infinitivo descriptivo (lo que sale en la card) al
    /// imperativo que va en el body de la notif. Patrones cubiertos por el
    /// QA del usuario:
    ///   "Salir 20 min antes"         → "Sal ahora."
    ///   "Llevar zapatos de fútbol"    → "Lleva zapatos de fútbol."
    ///   "Cargar el computador"        → "Carga el computador."
    ///   "Echar las zapatillas"        → "Echa las zapatillas."
    ///   "Preparar la presentación"    → "Prepara la presentación."
    ///   "Revisar el archivo"          → "Revisa el archivo."
    ///   "Comprar regalo"              → "Compra regalo."
    ///   "Mandar el archivo"           → "Manda el archivo."
    ///   "Llamar a mi mamá"            → "Llama a mi mamá."
    /// Si el verbo no matchea ningún patrón, devuelve el texto tal cual con
    /// punto final. Fallback seguro: nunca rompe; el peor caso es una notif
    /// en infinitivo (legible igual).
    private func toImperative(_ text: String, fireDate: Date, eventStart: Date) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "" }
        // "Salir N min antes" → "Sal ahora." (cuando dispara la notif, ya es
        // el momento de salir, así que "ahora" siempre es correcto).
        let salirRegex = try? NSRegularExpression(
            pattern: #"^salir\s+\d+\s*(?:min|minutos?|h|hora|horas?)\s*antes\.?$"#,
            options: [.caseInsensitive]
        )
        let trimRange = NSRange(trimmed.startIndex..., in: trimmed)
        if let r = salirRegex, r.firstMatch(in: trimmed, range: trimRange) != nil {
            return "Sal ahora."
        }
        // Tabla verbo infinitivo → imperativo 2ª persona singular (tú).
        let verbMap: [(infinitive: String, imperative: String)] = [
            ("llevar", "Lleva"),
            ("traer", "Trae"),
            ("cargar", "Carga"),
            ("echar", "Echa"),
            ("preparar", "Prepara"),
            ("revisar", "Revisa"),
            ("comprar", "Compra"),
            ("mandar", "Manda"),
            ("enviar", "Envía"),
            ("llamar", "Llama"),
            ("avisar", "Avisa"),
            ("recoger", "Recoge"),
            ("pasar", "Pasa"),
            ("salir", "Sal"),
            ("imprimir", "Imprime"),
            ("guardar", "Guarda"),
            ("buscar", "Busca"),
            ("anotar", "Anota"),
        ]
        for (inf, imp) in verbMap {
            // Match al inicio, palabra completa, case insensitive.
            let pattern = #"^"# + inf + #"\b"#
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            let range = NSRange(trimmed.startIndex..., in: trimmed)
            if let m = regex.firstMatch(in: trimmed, range: range), let matchRange = Range(m.range, in: trimmed) {
                let rest = trimmed[matchRange.upperBound...]
                let body = String(rest)
                return "\(imp)\(body)".trimmingCharacters(in: .whitespaces) + (trimmed.hasSuffix(".") ? "" : ".")
            }
        }
        // Sin verbo conocido al inicio → devolver tal cual con punto.
        return trimmed.hasSuffix(".") ? trimmed : "\(trimmed)."
    }

    /// Genera el subtitle según la relación entre el fireDate y el startTime
    /// del evento. Si la diferencia es ≥ 1 min, decimos "En N min".
    /// Si es 0 (o casi), decimos "Empieza a las HH:MM".
    private func subtitle(forFireDate fireDate: Date, eventStart: Date) -> String {
        let deltaMinutes = Int(round(eventStart.timeIntervalSince(fireDate) / 60))
        if deltaMinutes >= 1 {
            if deltaMinutes >= 60 && deltaMinutes % 60 == 0 {
                let h = deltaMinutes / 60
                return h == 1 ? "En 1 hora" : "En \(h) horas"
            }
            return deltaMinutes == 1 ? "En 1 min" : "En \(deltaMinutes) min"
        }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "es_CL")
        fmt.dateFormat = "HH:mm"
        return "Empieza a las \(fmt.string(from: eventStart))"
    }

    // MARK: - Cancellation

    /// Cancela TODAS las notifs pendientes asociadas al evento — la base
    /// (`focus-reminder-event-<id>`) y todas las variantes con sufijo
    /// `-0`, `-1`, etc. cuando hay múltiples offsets. Silencioso si no
    /// había nada pendiente.
    func cancelReminder(eventId: UUID) {
        let center = UNUserNotificationCenter.current()
        let base = Self.identifier(for: eventId)
        // Variantes posibles. 6 es defensivo: hoy soportamos máximo 1 offset
        // pero dejamos espacio si en el futuro queremos múltiples avisos.
        var candidates: [String] = [base]
        for i in 0..<6 { candidates.append("\(base)-\(i)") }
        center.removePendingNotificationRequests(withIdentifiers: candidates)
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
    /// (tap o swipe-to-open). Posteamos un `Notification.Name` interno
    /// para que `MainTabView` salte a Mi Día — ahí están los eventos del
    /// día y es la pantalla natural para confirmar que vio el aviso.
    ///
    /// Privacy: solo pasamos el `eventId` por userInfo, sin contenido
    /// del recordatorio. El listener decide qué hacer.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Solo respondemos al action default (tap del banner). Dismiss
        // y otras acciones del system no deberían navegar.
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else {
            completionHandler()
            return
        }
        let eventIdString = response.notification.request.content.userInfo["eventId"] as? String
        var payload: [AnyHashable: Any] = [:]
        if let eventIdString {
            payload["eventId"] = eventIdString
        }
        // Async hop al main para que el listener (UI) lo reciba en main thread.
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .focusReminderTapped,
                object: nil,
                userInfo: payload
            )
        }
        completionHandler()
    }
}
