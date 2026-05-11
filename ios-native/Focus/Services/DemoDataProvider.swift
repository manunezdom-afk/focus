import Foundation

/// Datos demo en español neutral (forma "tú"), realistas y útiles.
/// Sirven para que toda la app se sienta viva antes de conectar Supabase.
final class DemoDataProvider {
    static let shared = DemoDataProvider()

    private init() {}

    // MARK: - Helpers de fecha

    private func date(daysFromToday: Int, hour: Int, minute: Int = 0) -> Date {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let day = cal.date(byAdding: .day, value: daysFromToday, to: today) ?? today
        return cal.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
    }

    // MARK: - Eventos

    /// Eventos del día actual.
    func todayEvents() -> [FocusEvent] {
        let foco = FocusEvent(
            title: "Foco profundo: roadmap Q3",
            notes: "Sin notificaciones. Solo escritura y prioridades.",
            startTime: date(daysFromToday: 0, hour: 9, minute: 30),
            endTime: date(daysFromToday: 0, hour: 11),
            section: .foco,
            featured: true
        )

        let standup = FocusEvent(
            title: "Stand-up del equipo",
            notes: "Sincronizar prioridades del día.",
            startTime: date(daysFromToday: 0, hour: 11, minute: 15),
            endTime: date(daysFromToday: 0, hour: 11, minute: 35),
            section: .reunion,
            location: "Sala 3 · Meet"
        )

        let almuerzo = FocusEvent(
            title: "Almuerzo con Juan",
            notes: "Café Brío, hablar de la propuesta nueva.",
            startTime: date(daysFromToday: 0, hour: 13),
            endTime: date(daysFromToday: 0, hour: 14),
            section: .personal,
            location: "Café Brío"
        )

        let estudio = FocusEvent(
            title: "Estudiar Swift Concurrency",
            notes: "Capítulos 4 y 5.",
            startTime: date(daysFromToday: 0, hour: 14, minute: 30),
            endTime: date(daysFromToday: 0, hour: 15, minute: 15),
            section: .estudio
        )

        let llamada = FocusEvent(
            title: "Llamada con cliente Acme",
            notes: "Revisar propuesta y siguientes pasos.",
            startTime: date(daysFromToday: 0, hour: 15, minute: 30),
            endTime: date(daysFromToday: 0, hour: 16, minute: 15),
            section: .reunion,
            location: "Google Meet"
        )

        let descanso = FocusEvent(
            title: "Descanso · caminar",
            startTime: date(daysFromToday: 0, hour: 17),
            endTime: date(daysFromToday: 0, hour: 17, minute: 30),
            section: .descanso
        )

        let gym = FocusEvent(
            title: "Gym — pierna",
            notes: "Calentamiento + sentadillas + zancadas.",
            startTime: date(daysFromToday: 0, hour: 18, minute: 30),
            endTime: date(daysFromToday: 0, hour: 19, minute: 30),
            section: .personal
        )

        return [foco, standup, almuerzo, estudio, llamada, descanso, gym]
    }

    /// Eventos de toda la semana (lunes a domingo, hoy incluido).
    func weekEvents() -> [FocusEvent] {
        var events = todayEvents()

        // Mañana
        events.append(FocusEvent(
            title: "Revisión semanal",
            notes: "Repasar metas y desbloqueos.",
            startTime: date(daysFromToday: 1, hour: 9),
            endTime: date(daysFromToday: 1, hour: 10),
            section: .reunion,
            location: "Meet"
        ))
        events.append(FocusEvent(
            title: "Foco: documentar API",
            startTime: date(daysFromToday: 1, hour: 10, minute: 30),
            endTime: date(daysFromToday: 1, hour: 12),
            section: .foco
        ))
        events.append(FocusEvent(
            title: "Yoga",
            startTime: date(daysFromToday: 1, hour: 18),
            endTime: date(daysFromToday: 1, hour: 19),
            section: .personal
        ))

        // +2 días
        events.append(FocusEvent(
            title: "1:1 con Sofía",
            notes: "Feedback del trimestre.",
            startTime: date(daysFromToday: 2, hour: 11),
            endTime: date(daysFromToday: 2, hour: 11, minute: 45),
            section: .reunion
        ))
        events.append(FocusEvent(
            title: "Estudiar SwiftUI animations",
            startTime: date(daysFromToday: 2, hour: 16),
            endTime: date(daysFromToday: 2, hour: 17),
            section: .estudio
        ))

        // +3 días
        events.append(FocusEvent(
            title: "Demo interna",
            notes: "Mostrar avance de Focus a equipo.",
            startTime: date(daysFromToday: 3, hour: 14),
            endTime: date(daysFromToday: 3, hour: 15),
            section: .reunion,
            featured: true
        ))
        events.append(FocusEvent(
            title: "Bloque de foco — escribir release notes",
            startTime: date(daysFromToday: 3, hour: 9, minute: 30),
            endTime: date(daysFromToday: 3, hour: 11, minute: 30),
            section: .foco
        ))

        // +4 días (viernes típico)
        events.append(FocusEvent(
            title: "Presentación a cliente Acme",
            notes: "Final. No mover.",
            startTime: date(daysFromToday: 4, hour: 11),
            endTime: date(daysFromToday: 4, hour: 12),
            section: .reunion,
            featured: true
        ))
        events.append(FocusEvent(
            title: "Cena con Camila",
            startTime: date(daysFromToday: 4, hour: 20),
            endTime: date(daysFromToday: 4, hour: 22),
            section: .personal,
            location: "Sotto Restaurant"
        ))

        // +5 (sábado)
        events.append(FocusEvent(
            title: "Salir con amigos",
            startTime: date(daysFromToday: 5, hour: 13),
            endTime: date(daysFromToday: 5, hour: 17),
            section: .personal
        ))

        return events
    }

    // MARK: - Tareas

    func todayTasks() -> [FocusTask] {
        [
            FocusTask(
                title: "Revisar el informe del Q1",
                notes: "Foco en los KPIs de retención.",
                priority: .alta,
                category: .hoy,
                subtasks: [
                    FocusSubtask(title: "Leer resumen ejecutivo"),
                    FocusSubtask(title: "Marcar dudas para Sofía"),
                    FocusSubtask(title: "Anotar 3 acciones concretas")
                ]
            ),
            FocusTask(
                title: "Responder el mail de Ana",
                priority: .media,
                category: .hoy
            ),
            FocusTask(
                title: "Preparar propuesta para cliente Acme",
                priority: .alta,
                category: .hoy,
                subtasks: [
                    FocusSubtask(title: "Slide de problema"),
                    FocusSubtask(title: "Slide de solución"),
                    FocusSubtask(title: "Slide de precios", isCompleted: true)
                ]
            ),
            FocusTask(
                title: "Comprar regalo para mamá",
                priority: .baja,
                category: .hoy
            )
        ]
    }

    func weekTasks() -> [FocusTask] {
        [
            FocusTask(
                title: "Ordenar pendientes antes de la reunión",
                priority: .alta,
                category: .semana
            ),
            FocusTask(
                title: "Llamar al dentista",
                priority: .media,
                category: .semana
            ),
            FocusTask(
                title: "Pagar el seguro del auto",
                priority: .media,
                category: .semana
            ),
            FocusTask(
                title: "Revisar el calendario de la semana siguiente",
                priority: .baja,
                category: .semana
            )
        ]
    }

    func somedayTasks() -> [FocusTask] {
        [
            FocusTask(
                title: "Aprender animaciones avanzadas en SwiftUI",
                priority: .baja,
                category: .algunDia
            ),
            FocusTask(
                title: "Leer el libro que te recomendó Pedro",
                priority: .baja,
                category: .algunDia
            ),
            FocusTask(
                title: "Planear el viaje a Bariloche",
                priority: .baja,
                category: .algunDia,
                subtasks: [
                    FocusSubtask(title: "Comparar vuelos"),
                    FocusSubtask(title: "Buscar Airbnb"),
                    FocusSubtask(title: "Mirar excursiones")
                ]
            ),
            FocusTask(
                title: "Probar Linear con mi equipo",
                priority: .media,
                category: .algunDia
            )
        ]
    }

    func allTasks() -> [FocusTask] {
        todayTasks() + weekTasks() + somedayTasks()
    }

    // MARK: - Sugerencias de Nova

    func suggestions() -> [NovaSuggestion] {
        [
            NovaSuggestion(
                title: "Tu día está cargado entre 9:30 y 15:30",
                detail: "Tienes 4 bloques seguidos sin descanso. Te sugiero mover una tarea para mañana o reservar 20 minutos entre Acme y el estudio.",
                kind: .rebalance,
                priority: .high,
                suggestedAction: "Mover estudio a mañana"
            ),
            NovaSuggestion(
                title: "Falta un bloque de descanso",
                detail: "Después de la reunión con Acme no hay pausa. Te reservo 20 minutos a las 16:15.",
                kind: .break_,
                priority: .normal,
                suggestedAction: "Reservar pausa 16:15"
            ),
            NovaSuggestion(
                title: "Tienes 2 tareas sin horario",
                detail: "“Responder el mail de Ana” y “Comprar regalo para mamá” no tienen bloque asignado. Las puedo encajar entre tus reuniones.",
                kind: .schedule,
                priority: .normal,
                suggestedAction: "Asignar bloques"
            ),
            NovaSuggestion(
                title: "Preparar reunión con cliente Acme",
                detail: "Reservé 15 minutos a las 15:00 para que revises la propuesta antes de la llamada.",
                kind: .prep,
                priority: .high,
                suggestedAction: "Crear bloque de prep"
            ),
            NovaSuggestion(
                title: "Mañana hay espacio para foco",
                detail: "Entre 10:30 y 12:00 estás libre. Buen momento para avanzar el informe del Q1.",
                kind: .schedule,
                priority: .normal,
                suggestedAction: "Crear bloque de foco mañana"
            )
        ]
    }

    // MARK: - Mensajes Nova de bienvenida

    func welcomeNovaMessages() -> [NovaMessage] {
        [
            NovaMessage(
                role: .nova,
                content: "Hola. Soy Nova, tu centro inteligente para organizar el día.\n\nPuedo agendar eventos, crear tareas, mover bloques y resumir tu semana. ¿Por dónde empezamos?"
            )
        ]
    }
}
