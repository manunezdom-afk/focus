import Foundation

/// Datos demo realistas en español neutral ("tú").
/// Sirven para que la app se sienta viva antes de conectar Supabase (Fase 3).
final class DemoDataProvider {
    static let shared = DemoDataProvider()

    private init() {}

    // MARK: - Eventos

    func todayEvents() -> [FocusEvent] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        func at(_ hour: Int, _ minute: Int = 0) -> Date {
            cal.date(bySettingHour: hour, minute: minute, second: 0, of: today) ?? today
        }

        let foco = FocusEvent(
            title: "Foco profundo: roadmap Q3",
            startTime: at(9, 30),
            endTime: at(11, 0),
            detail: "Sin notificaciones. Solo escritura.",
            section: .foco,
            featured: true
        )

        let standup = FocusEvent(
            title: "Stand-up del equipo",
            startTime: at(11, 15),
            endTime: at(11, 35),
            detail: "Sincronizar prioridades del día.",
            section: .reunion
        )

        let almuerzo = FocusEvent(
            title: "Almuerzo con Juan",
            startTime: at(13, 0),
            endTime: at(14, 0),
            detail: "Café Brío, esquina de Pueyrredón.",
            section: .personal
        )

        let llamada = FocusEvent(
            title: "Llamada con cliente Acme",
            startTime: at(15, 30),
            endTime: at(16, 15),
            detail: "Revisar propuesta y siguientes pasos.",
            section: .reunion
        )

        let gym = FocusEvent(
            title: "Gym — pierna",
            startTime: at(18, 30),
            endTime: at(19, 30),
            detail: "Calentamiento + sentadillas + zancadas.",
            section: .evening
        )

        return [foco, standup, almuerzo, llamada, gym]
    }

    // MARK: - Tareas

    func todayTasks() -> [FocusTask] {
        [
            FocusTask(label: "Revisar el informe del Q1", priority: .alta, category: .hoy),
            FocusTask(label: "Responder el mail de Ana", priority: .media, category: .hoy),
            FocusTask(label: "Comprar regalo para mamá", priority: .baja, category: .hoy)
        ]
    }

    func weekTasks() -> [FocusTask] {
        [
            FocusTask(label: "Preparar la presentación del viernes", priority: .alta, category: .semana),
            FocusTask(label: "Llamar al dentista", priority: .media, category: .semana),
            FocusTask(label: "Pagar el seguro del auto", priority: .media, category: .semana)
        ]
    }

    func somedayTasks() -> [FocusTask] {
        [
            FocusTask(label: "Aprender animaciones avanzadas en SwiftUI", priority: .baja, category: .algunDia),
            FocusTask(label: "Leer el libro que te recomendó Pedro", priority: .baja, category: .algunDia),
            FocusTask(label: "Planear el viaje a Bariloche", priority: .baja, category: .algunDia)
        ]
    }

    // MARK: - Sugerencias

    func sampleSuggestions() -> [Suggestion] {
        [
            Suggestion(
                kind: .event,
                title: "Bloque de foco mañana a las 8:00",
                body: "Reservé 90 minutos para que termines el informe del Q1.",
                reason: "Notamos que te concentras mejor a primera hora."
            ),
            Suggestion(
                kind: .task,
                title: "Confirmar reunión con Acme",
                body: "Todavía no respondiste el correo del jueves.",
                reason: "El cliente preguntó dos veces esta semana."
            )
        ]
    }
}
