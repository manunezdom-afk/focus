import SwiftUI

struct MiDiaView: View {
    @EnvironmentObject private var store: FocusDataStore
    @EnvironmentObject private var nav: NavigationCoordinator
    @EnvironmentObject private var toast: ToastManager
    @State private var focusBarText: String = ""
    @State private var showAllEvents: Bool = false
    @State private var showVoiceComingSoon: Bool = false
    /// Evento que se está editando vía sheet. nil = sheet cerrado.
    @State private var editingEvent: FocusEvent? = nil
    /// Tarea que se está editando vía sheet. nil = sheet cerrado.
    @State private var editingTask: FocusTask? = nil
    /// Última respuesta inline de Nova. Se reemplaza al enviar otra petición
    /// y se puede cerrar manualmente. NO está en el store; es estado de UI.
    @State private var inlineResponse: InlineNovaResponse? = nil
    // Descartes de demo viven ahora en `FocusDataStore` (persisten a disco).
    // Acceso: `store.dismissedDemoEventTitles` / `store.dismissedDemoTaskTitles`
    // y `store.dismissDemoEvent(title:)` / `store.dismissDemoTask(title:)`.

    /// 3 bloques visibles por defecto — más allá de eso es ruido.
    private let visibleEventsLimit: Int = 3

    /// 3 tareas pendientes visibles en Mi Día — el resto vive en Nova.
    private let visiblePendingTasksLimit: Int = 3

    // MARK: - Source of truth

    /// Eventos visibles: del usuario si tiene, demo si no (excluyendo los
    /// títulos descartados — persisten a disco vía store).
    private var displayEvents: [FocusEvent] {
        if store.hasUserEvents {
            return store.todayEvents()
        }
        return DemoDataProvider.shared.exampleTodayEvents()
            .filter { !store.dismissedDemoEventTitles.contains($0.title) }
    }

    /// Pendientes visibles: del usuario si tiene, demo si no (excluyendo
    /// descartados — persisten a disco vía store).
    private var displayPendingTasks: [FocusTask] {
        if store.hasUserTasks {
            return store.pendingTodayTasks
        }
        return DemoDataProvider.shared.exampleTodayTasks()
            .filter { !$0.done && !store.dismissedDemoTaskTitles.contains($0.title) }
    }

    private var nextBlock: FocusEvent? {
        let now = Date()
        return displayEvents.first { ($0.endTime ?? $0.startTime) >= now }
    }

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            // Hero zone: gradiente sutil detrás del header — identidad de Mi Día.
            VStack(spacing: 0) {
                LinearGradient(
                    colors: [
                        Theme.Colors.focusAccent.opacity(0.08),
                        Theme.Colors.background
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 300)
                Spacer()
            }
            .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    header
                        .padding(.horizontal, Theme.Spacing.xl)
                        // Padding superior generoso para que el header no
                        // quede pegado al notch/Dynamic Island. iOS ya respeta
                        // safeArea, pero +12pt extra da aire para la marca.
                        .padding(.top, Theme.Spacing.lg)

                    focusBar
                        .padding(.horizontal, Theme.Spacing.xl)

                    // Respuesta inline de Nova: aparece DEBAJO del FocusBar al
                    // procesar una petición. Mi Día NO navega al Chat — toda
                    // la confirmación de acciones queda visible acá.
                    if let resp = inlineResponse {
                        InlineNovaResponseView(
                            response: resp,
                            onAction: { handleInlineAction(resp.action) },
                            onDismiss: {
                                withAnimation(.easeOut(duration: 0.20)) {
                                    inlineResponse = nil
                                }
                            }
                        )
                        .padding(.horizontal, Theme.Spacing.xl)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    if let next = nextBlock {
                        SwipeToDelete(enabled: true) {
                            if store.hasUserEvents {
                                store.deleteEvent(next.id)
                            } else {
                                withAnimation(.easeOut(duration: 0.22)) {
                                    store.dismissDemoEvent(title: next.title)
                                }
                            }
                            toast.success("Evento eliminado", symbol: "trash.fill")
                        } content: {
                            ProximoBloqueCard(
                                event: next,
                                onEdit: store.hasUserEvents ? { editingEvent = next } : nil,
                                onDelete: {
                                    if store.hasUserEvents {
                                        store.deleteEvent(next.id)
                                    } else {
                                        store.dismissDemoEvent(title: next.title)
                                    }
                                    toast.success("Evento eliminado", symbol: "trash.fill")
                                }
                            )
                        }
                        .padding(.horizontal, Theme.Spacing.xl)
                    }

                    timelineSection

                    pendingTasksSection

                    Spacer(minLength: Theme.Spacing.bottomBarSafety)
                }
                .padding(.top, Theme.Spacing.sm)
            }
            // Scroll dismisses keyboard: tan pronto como el usuario arrastra
            // hacia abajo, el teclado se baja. Patrón nativo iOS.
            .scrollDismissesKeyboard(.immediately)
            // Tap-outside dismiss: cualquier tap en el scroll cierra el
            // teclado. `.simultaneousGesture` corre en paralelo con los taps
            // de botones — no consume sus acciones.
            .simultaneousGesture(
                TapGesture().onEnded { _ in
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder),
                        to: nil, from: nil, for: nil
                    )
                }
            )
        }
        .alert("Voz próximamente", isPresented: $showVoiceComingSoon) {
            Button("Entendido", role: .cancel) {}
        } message: {
            Text("El dictado por voz para Nova está en preparación. Por ahora puedes escribir tu mensaje.")
        }
        // Sheets de edición — se abren desde el menú "Editar" de cualquier
        // evento o tarea real en Mi Día.
        .sheet(item: $editingEvent) { event in
            NuevoEventoSheet(editing: event) { updated in
                store.updateEvent(updated)
                toast.success("Evento actualizado")
            }
            .presentationDetents([.medium, .large])
            .presentationBackground(Theme.Colors.background)
        }
        .sheet(item: $editingTask) { task in
            NuevaTareaSheet(editing: task) { updated in
                store.updateTask(updated)
                toast.success("Tarea actualizada")
            }
            .presentationDetents([.medium])
            .presentationBackground(Theme.Colors.background)
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                FocusBrandRow()
                Spacer()
                HStack(spacing: Theme.Spacing.sm) {
                    bandejaButton
                    profileButton
                }
            }
            Text("Mi Día")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
        }
    }

    private var bandejaButton: some View {
        Button {
            HapticManager.shared.tap()
            nav.openNova(segment: .bandeja)
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "tray.full")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .frame(width: 42, height: 42)
                    .background(
                        Circle()
                            .fill(Theme.Colors.surface)
                            .overlay(
                                Circle().strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                            )
                    )
                    .focusCardShadow()
                if store.pendingDisplaySuggestions.count > 0 {
                    Circle()
                        .fill(Theme.Colors.novaAccent)
                        .frame(width: 10, height: 10)
                        .overlay(Circle().strokeBorder(Theme.Colors.background, lineWidth: 2))
                        .offset(x: 2, y: -2)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Bandeja de Nova")
    }

    private var profileButton: some View {
        Button {
            HapticManager.shared.tap()
            withAnimation(.easeInOut(duration: 0.28)) {
                nav.selectedTab = .ajustes
            }
        } label: {
            Circle()
                .fill(Theme.Colors.surface)
                .frame(width: 42, height: 42)
                .overlay(
                    Circle().strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                )
                .overlay(
                    Image(systemName: "person.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Colors.textSecondary)
                )
                .focusCardShadow()
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Ajustes")
    }

    // MARK: - FocusBar (entry point omnipresente a Nova)

    private var focusBar: some View {
        FocusBarInput(
            text: $focusBarText,
            placeholder: "Pregúntale a Nova…",
            onSubmit: {
                let text = focusBarText
                focusBarText = ""
                // Cerrar teclado tras enviar — el usuario ve la respuesta
                // inline sin que el teclado tape Mi Día.
                UIApplication.shared.sendAction(
                    #selector(UIResponder.resignFirstResponder),
                    to: nil, from: nil, for: nil
                )
                processNovaInline(text: text)
            },
            onMic: {
                HapticManager.shared.tap()
                showVoiceComingSoon = true
            }
        )
    }

    // MARK: - Nova inline (interacción principal desde Mi Día)

    /// Procesa la petición del usuario:
    /// 1. Si hay sesión (`syncCredentials` no es nil), llama al backend
    ///    `/api/focus-assistant` vía `NovaService`. Si responde OK,
    ///    aplica las `actions` al store (sync Supabase automático) y
    ///    muestra el `reply` como inline response.
    /// 2. Si el backend falla con error "esperable" (401/429/timeout/red/
    ///    quota), cae a `NovaResponder.parse` con una nota sutil al final.
    /// 3. Si está en modo demo o no logueado, va directo al parser local
    ///    (sin llamar backend, sin nota).
    /// Mantiene la inline response abajo del FocusBar — no navega al chat.
    private func processNovaInline(text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        HapticManager.shared.tap()

        // Loading inmediato — el usuario ve "procesando" mientras se decide
        // el path (local o remoto).
        withAnimation(.easeInOut(duration: 0.18)) {
            inlineResponse = InlineNovaResponse(
                userText: trimmed,
                summary: "Procesando…",
                isLoading: true
            )
        }

        Task { @MainActor in
            let response = await resolveNovaResponse(for: trimmed)
            withAnimation(.easeInOut(duration: 0.20)) {
                inlineResponse = response
            }
        }
    }

    /// Decide backend vs. fallback local y devuelve el `InlineNovaResponse`
    /// final. Centralizado acá para que `processNovaInline` quede limpio.
    private func resolveNovaResponse(for trimmed: String) async -> InlineNovaResponse {
        // Sin sesión activa → parser local directo. No mostramos nota
        // porque el usuario está en modo demo a propósito.
        guard let creds = store.syncCredentials else {
            return runLocalFallback(for: trimmed, withNote: nil)
        }

        do {
            let result = try await NovaService.send(
                message: trimmed,
                events: visibleEventsForContext(),
                tasks: visibleTasksForContext(),
                history: recentNovaHistory(),
                accessToken: creds.accessToken,
                surface: .inlineMiDia
            )
            return await applyBackendResult(result, userText: trimmed)
        } catch let error as NovaServiceError {
            if error.canFallbackToLocal {
                let note = humanFallbackNote(for: error)
                return runLocalFallback(for: trimmed, withNote: note)
            }
            return InlineNovaResponse(
                userText: trimmed,
                summary: "Nova tuvo un problema.",
                details: error.errorDescription ?? "Inténtalo en un momento.",
                isError: true
            )
        } catch {
            return runLocalFallback(for: trimmed, withNote: "Usé el modo local porque Nova avanzada no respondió.")
        }
    }

    /// Aplica el `NovaService.Result` al store y arma el inline response.
    /// Si el backend solo devolvió `reply` sin actions (clarify o smalltalk),
    /// mostramos solo el texto.
    private func applyBackendResult(_ result: NovaService.Result, userText: String) async -> InlineNovaResponse {
        let outcome = store.applyBackendActions(result.actions, userText: userText)

        let replyText = result.reply.trimmingCharacters(in: .whitespacesAndNewlines)
        // Cuota de smart actions agotada: pegar nota humana al final.
        let blockedNote: String? = result.smartActionsBlocked
            ? (result.smartActionsMessage ?? "Llegaste al límite diario de acciones de Nova.")
            : nil

        if outcome.didMutate {
            // Hubo mutación: usamos el resumen del outcome como cabecera +
            // el reply textual como detalle. Acción contextual según tipo.
            let summary = outcome.summary ?? "Listo."
            var details: String? = replyText.isEmpty ? nil : replyText
            if let note = blockedNote {
                details = [details, note].compactMap { $0 }.joined(separator: "\n\n")
            }
            let action: InlineNovaAction = {
                if outcome.primaryEventId != nil { return .openCalendar }
                if outcome.primaryTaskId != nil { return .openTasksList }
                return .dismiss
            }()
            return InlineNovaResponse(
                userText: userText,
                summary: summary,
                details: details,
                action: action,
                isError: false
            )
        }

        // No hubo mutación: el backend devolvió solo texto (clarify o info).
        let summary: String
        let details: String?
        if !replyText.isEmpty {
            // Si el reply es corto y único, usarlo como summary; sino
            // partir título/detalle por primera oración.
            let parts = splitReplyForUI(replyText)
            summary = parts.summary
            details = parts.details
        } else {
            summary = "Nova respondió sin texto."
            details = nil
        }
        let merged: String? = {
            guard let note = blockedNote else { return details }
            return [details, note].compactMap { $0 }.joined(separator: "\n\n")
        }()
        return InlineNovaResponse(
            userText: userText,
            summary: summary,
            details: merged,
            action: .dismiss,
            isError: false
        )
    }

    /// Corre el parser local y arma el inline response. Si `note` viene
    /// dado, lo agrega al final del details para que el usuario sepa por
    /// qué se usó fallback.
    private func runLocalFallback(for trimmed: String, withNote note: String?) -> InlineNovaResponse {
        let intent = NovaResponder.parse(trimmed, context: store.novaContext)
        var response = executeIntent(intent, userText: trimmed)
        if let note {
            response.details = [response.details, note].compactMap { $0 }.joined(separator: "\n\n")
        }
        return response
    }

    /// Eventos que vamos a enviar como contexto al backend. Limita a hoy
    /// + mañana + 7 días siguientes para no pasar el límite de tokens.
    private func visibleEventsForContext() -> [FocusEvent] {
        let cal = Calendar.current
        let now = Date()
        let horizon = cal.date(byAdding: .day, value: 7, to: now) ?? now
        return store.events
            .filter { $0.startTime >= cal.startOfDay(for: now) && $0.startTime <= horizon }
            .sorted { $0.startTime < $1.startTime }
    }

    private func visibleTasksForContext() -> [FocusTask] {
        store.tasks.filter { !$0.done }
    }

    /// Convierte los últimos turnos del chat en el shape `history` del
    /// backend. Limita a 12 turnos (6 ida/vuelta).
    private func recentNovaHistory() -> [NovaService.HistoryEntry] {
        let recent = store.novaMessages.suffix(12)
        return recent.map { msg in
            NovaService.HistoryEntry(
                role: msg.role == .user ? .user : .assistant,
                content: msg.content
            )
        }
    }

    /// Mensajes amables que mostramos cuando el backend falla y caemos a local.
    private func humanFallbackNote(for error: NovaServiceError) -> String? {
        switch error {
        case .unauthorized:
            return "Tu sesión expiró. Estoy usando el modo local mientras vuelves a iniciar sesión."
        case .quotaExceeded(let message):
            return message ?? "Llegaste al límite diario de Nova. Estoy usando el modo local."
        case .offline:
            return "Sin conexión. Estoy usando el modo local."
        case .timeout, .serviceUnavailable, .badLLMOutput, .network:
            return "Usé el modo local porque Nova avanzada no respondió."
        default:
            return nil
        }
    }

    /// Split del reply del backend en (summary, details). El backend ya
    /// devuelve máx 2 oraciones; si hay punto final, lo partimos ahí.
    private func splitReplyForUI(_ raw: String) -> (summary: String, details: String?) {
        let normalized = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        // Buscar primer punto seguido de espacio o fin de string.
        if let dotRange = normalized.range(of: #"[.!?]\s+"#, options: .regularExpression) {
            let first = String(normalized[..<dotRange.upperBound])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let rest = String(normalized[dotRange.upperBound...])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if rest.isEmpty {
                return (first, nil)
            }
            return (first, rest)
        }
        return (normalized, nil)
    }

    private func executeIntent(_ intent: NovaIntent, userText: String) -> InlineNovaResponse {
        switch intent {
        case .createTask(let title, let dueDate, let recurrence, let wantsReminder):
            // Si hay fecha y es hoy/mañana/esta semana, usamos esa categoría;
            // si es más lejos, .algunDia. La category se mantiene compatible
            // con el modelo existente; dueDate es metadata adicional.
            let category = categoryForDueDate(dueDate)
            let task = FocusTask(
                title: title,
                priority: .media,
                category: category,
                dueDate: dueDate
            )
            store.addTask(task)
            store.updateNovaContext(
                from: userText,
                title: title,
                date: dueDate,
                kind: .task,
                taskId: task.id
            )
            let reminderNote = wantsReminder ? " Las notificaciones automáticas están en preparación." : ""
            let dueLabel: String? = {
                guard let d = dueDate else { return nil }
                let cal = Calendar.current
                if cal.isDateInToday(d) { return "hoy" }
                if cal.isDateInTomorrow(d) { return "mañana" }
                return DateFormatters.weekdayDay.string(from: d).lowercased()
            }()
            if let rec = recurrence {
                let due = dueLabel.map { " para el \($0)" } ?? ""
                return InlineNovaResponse(
                    userText: userText,
                    summary: "Tarea creada (sin recurrencia todavía).",
                    details: "«\(title)»\(due). La recurrencia (\(rec.label)) la dejamos preparada para más adelante.\(reminderNote)",
                    action: .openTasksList
                )
            }
            let summary: String
            if let due = dueLabel {
                summary = "Tarea creada para \(due)."
            } else {
                summary = "Tarea creada en pendientes de hoy."
            }
            return InlineNovaResponse(
                userText: userText,
                summary: summary,
                details: "«\(title)»\(reminderNote)",
                action: .openTasksList
            )

        case .createEvent(let title, let when, let explicitEnd, let location, let section, let wantsReminder):
            guard let date = when else {
                return InlineNovaResponse(
                    userText: userText,
                    summary: "Necesito saber el día y la hora.",
                    details: "Probá: «agenda \(title) mañana a las 12».",
                    isError: true
                )
            }
            let cal = Calendar.current
            // Tres rutas:
            // 1) Recordatorio (wantsReminder o intención puntual) → duración
            //    interna mínima 5 min + isReminder=true, UI como punto.
            // 2) Rango explícito ("de 3 a 4", "hasta 4", "por 1h") → end real,
            //    UI como rango. inferredDuration = false.
            // 3) Sin end-time explícita y sin reminder → duración interna 5 min
            //    pero `inferredDuration: true` para que la UI lo muestre como
            //    punto puntual.
            let end: Date
            let isReminderFlag: Bool?
            let inferredFlag: Bool?
            if wantsReminder {
                end = cal.date(byAdding: .minute, value: 5, to: date) ?? date
                isReminderFlag = true
                inferredFlag = nil
            } else if let explicit = explicitEnd, explicit > date {
                end = explicit
                isReminderFlag = nil
                inferredFlag = false
            } else {
                end = cal.date(byAdding: .minute, value: 5, to: date) ?? date
                isReminderFlag = nil
                inferredFlag = true
            }

            let effectiveSection: EventSection
            if wantsReminder {
                effectiveSection = section ?? .reminder
            } else {
                effectiveSection = section ?? .reunion
            }
            let event = FocusEvent(
                title: title,
                startTime: date,
                endTime: end,
                section: effectiveSection,
                location: location,
                isReminder: isReminderFlag,
                inferredDuration: inferredFlag
            )
            store.addEvent(event)
            store.updateNovaContext(
                from: userText,
                title: title,
                date: date,
                location: location,
                section: effectiveSection,
                kind: .event,
                eventId: event.id
            )
            let timeLabel = DateFormatters.hourMinute.string(from: date)
            let dayLabel = DateFormatters.capitalizeFirst(
                DateFormatters.weekdayDay.string(from: date)
            )
            let kindLabel = wantsReminder ? "recordatorio" : effectiveSection.displayName.lowercased()
            var detail = "\(dayLabel) · \(timeLabel) · \(kindLabel)"
            if let loc = location { detail += " · \(loc)" }
            if wantsReminder {
                detail += "\nLas notificaciones automáticas están en preparación."
            }
            return InlineNovaResponse(
                userText: userText,
                summary: wantsReminder ? "Recordatorio agendado." : "Evento agregado a Calendario.",
                details: detail,
                action: .openCalendar
            )

        case .correctLastEvent(let modifier):
            guard let eventId = store.novaContext.lastEventId,
                  var event = store.events.first(where: { $0.id == eventId }) else {
                return InlineNovaResponse(
                    userText: userText,
                    summary: "No tengo nada reciente para mover.",
                    details: "Si querés crear un nuevo evento, decime título, día y hora.",
                    action: .dismiss,
                    isError: true
                )
            }
            let cal = Calendar.current
            switch modifier {
            case .shiftDays(let offset):
                if let newStart = cal.date(byAdding: .day, value: offset, to: event.startTime) {
                    event.startTime = newStart
                }
                if let oldEnd = event.endTime,
                   let newEnd = cal.date(byAdding: .day, value: offset, to: oldEnd) {
                    event.endTime = newEnd
                }
            case .setTime(let h, let m):
                let day = cal.startOfDay(for: event.startTime)
                if let newStart = cal.date(bySettingHour: h, minute: m, second: 0, of: day) {
                    event.startTime = newStart
                    event.endTime = cal.date(byAdding: .hour, value: 1, to: newStart)
                }
            case .setLocation(let loc):
                event.location = loc
            case .setTitle(let newTitle):
                event.title = newTitle
            }
            store.updateEvent(event)
            store.updateNovaContext(
                from: userText,
                title: event.title,
                date: event.startTime,
                location: event.location,
                section: event.section,
                kind: .event,
                eventId: event.id
            )
            let timeLabel = DateFormatters.hourMinute.string(from: event.startTime)
            let dayLabel = DateFormatters.capitalizeFirst(
                DateFormatters.weekdayDay.string(from: event.startTime)
            )
            return InlineNovaResponse(
                userText: userText,
                summary: "Evento actualizado.",
                details: "«\(event.title)» · \(dayLabel) · \(timeLabel)",
                action: .openCalendar
            )

        case .convertLastToTask:
            // Convertir el último evento en tarea: agregar tarea con el título
            // y borrar el evento. NO usamos contexto del lastTask porque
            // estamos pasando un evento a tarea.
            let title = store.novaContext.lastTitle ?? "Nueva tarea"
            let task = FocusTask(title: title, priority: .media, category: .hoy)
            store.addTask(task)
            if let eventId = store.novaContext.lastEventId {
                store.deleteEvent(eventId)
            }
            store.updateNovaContext(
                from: userText,
                title: title,
                kind: .task,
                taskId: task.id
            )
            return InlineNovaResponse(
                userText: userText,
                summary: "Listo, lo paso a tareas.",
                details: "«\(title)» quedó en pendientes de hoy.",
                action: .openTasksList
            )

        case .deleteLastItem:
            // Borrar el último ítem creado (evento o tarea) usando el contexto.
            let ctx = store.novaContext
            if let eventId = ctx.lastEventId, store.events.contains(where: { $0.id == eventId }) {
                let title = ctx.lastTitle ?? "Evento"
                store.deleteEvent(eventId)
                store.clearNovaContext()
                return InlineNovaResponse(
                    userText: userText,
                    summary: "Eliminado.",
                    details: "«\(title)» se borró del calendario.",
                    action: .dismiss
                )
            }
            if let taskId = ctx.lastTaskId, store.tasks.contains(where: { $0.id == taskId }) {
                let title = ctx.lastTitle ?? "Tarea"
                store.deleteTask(taskId)
                store.clearNovaContext()
                return InlineNovaResponse(
                    userText: userText,
                    summary: "Eliminada.",
                    details: "«\(title)» se borró de pendientes.",
                    action: .dismiss
                )
            }
            return InlineNovaResponse(
                userText: userText,
                summary: "No tengo nada reciente para borrar.",
                details: "Si querés borrar algo más viejo, arrastrá a la izquierda en Mi Día o Calendario.",
                action: .dismiss,
                isError: true
            )

        case .organizeDay:
            store.addSuggestion(NovaSuggestion(
                title: "Plan del día actualizado",
                detail: "Bloqueé tu mañana para foco profundo y dejé pendientes para después del mediodía. Aprueba para aplicar.",
                kind: .rebalance,
                priority: .high,
                suggestedAction: "Aplicar plan del día"
            ))
            store.addSuggestion(NovaSuggestion(
                title: "Pausa al mediodía",
                detail: "Te reservo 20 min sin notificaciones entre clases.",
                kind: .break_,
                priority: .normal,
                suggestedAction: "Reservar pausa 13:00"
            ))
            store.addSuggestion(NovaSuggestion(
                title: "Repaso para mañana",
                detail: "Te dejo un bloque de 60 min antes de tu próxima entrega.",
                kind: .prep,
                priority: .normal,
                suggestedAction: "Bloquear repaso"
            ))
            return InlineNovaResponse(
                userText: userText,
                summary: "Te dejé 3 sugerencias en la Bandeja.",
                details: "Aprueba las que te sirvan; las demás se descartan.",
                action: .openBandeja
            )

        case .reviewPending:
            let pending = store.pendingTodayTasks
            if pending.isEmpty {
                return InlineNovaResponse(
                    userText: userText,
                    summary: "No tienes pendientes de hoy. Disfrutalo."
                )
            }
            let preview = pending.prefix(3).map { "• \($0.title)" }.joined(separator: "\n")
            return InlineNovaResponse(
                userText: userText,
                summary: pending.count == 1
                    ? "Tienes 1 pendiente hoy."
                    : "Tienes \(pending.count) pendientes hoy.",
                details: preview,
                action: pending.count > 3 ? .openTasksList : nil
            )

        case .askAboutDemo:
            return InlineNovaResponse(
                userText: userText,
                summary: "Los ejemplos desaparecen automáticamente.",
                details: "Solo aparecen mientras no tengas datos tuyos. Apenas crees tu primer evento o tarea, se reemplazan.",
                action: nil
            )

        case .smallTalk(let reply):
            return InlineNovaResponse(
                userText: userText,
                summary: reply
            )

        case .clarify(let reason):
            // Guarda pending clarification para que el siguiente turno corto
            // pueda completar la acción sin perder contexto.
            if let pending = buildPendingClarification(
                from: reason,
                userText: userText,
                source: .inlineMiDia
            ) {
                store.setPendingClarification(pending)
            }
            return InlineNovaResponse(
                userText: userText,
                summary: clarifyHeadline(reason),
                details: clarifyDetail(reason),
                action: .openChat,
                isError: true
            )
        }
    }

    /// Convierte un `ClarifyReason` en un `PendingClarification` apto para
    /// guardarse en `NovaContext`. Devuelve nil cuando la clarify no tiene
    /// suficiente info para resolver follow-ups (taskNeedsTitle, noContext,
    /// unclear) — esos casos requieren que el usuario empiece de nuevo.
    private func buildPendingClarification(
        from reason: NovaIntent.ClarifyReason,
        userText: String,
        source: PendingClarification.Source
    ) -> PendingClarification? {
        let lower = userText.lowercased()
        let wantsReminder = lower.contains("acu") || lower.contains("recu")
        let section = NovaResponder.guessSection(for: userText)
        switch reason {
        case .eventNeedsTime(let title, let date):
            return PendingClarification(
                originalInput: userText,
                kind: wantsReminder ? .reminder : .event,
                proposedTitle: title,
                proposedDate: date,
                proposedSection: section,
                wantsReminder: wantsReminder,
                missingFields: [.time],
                questionAsked: "¿A qué hora?",
                source: source
            )
        case .eventNeedsDateTime(let title):
            return PendingClarification(
                originalInput: userText,
                kind: wantsReminder ? .reminder : .event,
                proposedTitle: title,
                proposedDate: nil,
                proposedSection: section,
                wantsReminder: wantsReminder,
                missingFields: [.date, .time],
                questionAsked: "¿Para qué día y hora?",
                source: source
            )
        case .taskNeedsTitle, .eventNeedsTitle, .noContext, .unclear:
            return nil
        }
    }

    /// Mapea una fecha de deadline a la categoría legacy del modelo
    /// `FocusTask` (hoy / semana / algún día). Necesario hasta que migremos
    /// a categorías derivadas de la fecha real.
    private func categoryForDueDate(_ date: Date?) -> TaskCategory {
        guard let date else { return .hoy }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return .hoy }
        // Mañana o cualquier día dentro de los próximos 7 días → semana.
        if let diff = cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: date)).day,
           diff >= 1 && diff <= 7 {
            return .semana
        }
        return .algunDia
    }

    private func clarifyHeadline(_ reason: NovaIntent.ClarifyReason) -> String {
        switch reason {
        case .taskNeedsTitle:           return "¿Qué tarea quieres que anote?"
        case .eventNeedsTitle:          return "¿Qué evento quieres agendar?"
        case .eventNeedsTime(let title, _):
            return "Tengo «\(title)». ¿A qué hora?"
        case .eventNeedsDateTime(let title):
            return "Tengo «\(title)». ¿Cuándo?"
        case .noContext:                return "No estoy seguro a qué te refieres."
        case .unclear:                  return "No estoy seguro de qué hacer."
        }
    }

    private func clarifyDetail(_ reason: NovaIntent.ClarifyReason) -> String {
        switch reason {
        case .taskNeedsTitle:
            return "Prueba: «crea tarea estudiar cálculo»."
        case .eventNeedsTitle:
            return "Prueba: «agenda reunión con Juan mañana a las 12»."
        case .eventNeedsTime(_, let date):
            let day = DateFormatters.weekdayDay.string(from: date).lowercased()
            return "Dime una hora para el \(day). Ej: «a las 14» o «tipo 3»."
        case .noContext:
            return "Vuelve a decirme qué quieres crear. Ej: «agenda reunión mañana a las 12»."
        case .eventNeedsDateTime(let title):
            return "Dime cuándo. Ej: «\(title) mañana a las 12»."
        case .unclear:
            return "Puedo crear tareas, agendar eventos u ordenar tu día. Dime con más detalle."
        }
    }

    private func handleInlineAction(_ action: InlineNovaAction?) {
        guard let action else { return }
        HapticManager.shared.tap()
        switch action {
        case .openCalendar:
            withAnimation(.easeInOut(duration: 0.28)) {
                nav.selectedTab = .calendario
            }
        case .openTasksList:
            // Por ahora salta a Nova → Acciones donde está el link "Todas las
            // tareas". Cuando exista una vista de pendientes dedicada, se
            // ajusta acá.
            nav.openNova(segment: .acciones)
        case .openBandeja:
            nav.openNova(segment: .bandeja)
        case .openChat:
            nav.openNova(segment: .chat)
        case .dismiss:
            withAnimation(.easeOut(duration: 0.20)) {
                inlineResponse = nil
            }
        }
    }

    // MARK: - Timeline

    @ViewBuilder
    private var timelineSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text("TU DÍA")
                    .sectionLabelStyle()
                Spacer()
                if !displayEvents.isEmpty {
                    Text("\(displayEvents.count) bloques")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                        .tracking(0.3)
                }
            }
            .padding(.horizontal, Theme.Spacing.xl)

            if displayEvents.isEmpty {
                EmptyStateView(
                    symbol: "sun.max",
                    title: "Tu día está libre",
                    message: "Agrega un bloque o pídele a Nova que lo organice.",
                    actionLabel: "Hablar con Nova",
                    action: { nav.openNova() }
                )
                .frame(minHeight: 260)
                .padding(.horizontal, Theme.Spacing.xl)
            } else {
                let shown = showAllEvents
                    ? displayEvents
                    : Array(displayEvents.prefix(visibleEventsLimit))
                let hiddenCount = displayEvents.count - shown.count

                VStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.element.id) { idx, event in
                        SwipeToDelete(enabled: true) {
                            if store.hasUserEvents {
                                store.deleteEvent(event.id)
                            } else {
                                withAnimation(.easeOut(duration: 0.22)) {
                                    store.dismissDemoEvent(title: event.title)
                                }
                            }
                            toast.success("Evento eliminado", symbol: "trash.fill")
                        } content: {
                            TimelineEventRow(
                                event: event,
                                isLast: idx == shown.count - 1 && hiddenCount == 0
                            )
                        }
                        .contextMenu {
                            if store.hasUserEvents {
                                Button {
                                    editingEvent = event
                                } label: {
                                    Label("Editar", systemImage: "pencil")
                                }
                            }
                            Button(role: .destructive) {
                                if store.hasUserEvents {
                                    store.deleteEvent(event.id)
                                } else {
                                    store.dismissDemoEvent(title: event.title)
                                }
                                toast.success("Evento eliminado", symbol: "trash.fill")
                            } label: {
                                Label("Eliminar", systemImage: "trash")
                            }
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)

                if hiddenCount > 0 {
                    Button {
                        HapticManager.shared.tick()
                        withAnimation(.easeInOut(duration: 0.25)) {
                            showAllEvents = true
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Text("Ver \(hiddenCount) \(hiddenCount == 1 ? "bloque más" : "bloques más")")
                                .font(Theme.Typography.subheadEmphasized)
                                .foregroundStyle(Theme.Colors.focusAccent)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.Colors.focusAccent)
                        }
                        .padding(.vertical, Theme.Spacing.md - 2)
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.xs)
                }
            }
        }
    }

    // MARK: - Pendientes de hoy (compacto)

    /// Sección compacta — máximo 3 pendientes. Si hay más o el usuario quiere
    /// la lista completa, se delega a Nova → Acciones → Todas las tareas.
    @ViewBuilder
    private var pendingTasksSection: some View {
        let pending = displayPendingTasks
        let shown = Array(pending.prefix(visiblePendingTasksLimit))
        let extra = pending.count - shown.count

        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text("PENDIENTES DE HOY")
                    .sectionLabelStyle()
                Spacer()
                Text(pendingHeaderTrailing(count: pending.count))
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .tracking(0.3)
            }
            .padding(.horizontal, Theme.Spacing.xl)

            if shown.isEmpty {
                HStack(spacing: Theme.Spacing.md) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Theme.Colors.success)
                    Text("Terminaste tus pendientes de hoy.")
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    Spacer()
                }
                .focusCard()
                .padding(.horizontal, Theme.Spacing.xl)
            } else {
                VStack(spacing: Theme.Spacing.sm) {
                    ForEach(shown) { task in
                        SwipeToDelete(enabled: true) {
                            if store.hasUserTasks {
                                store.deleteTask(task.id)
                            } else {
                                withAnimation(.easeOut(duration: 0.22)) {
                                    store.dismissDemoTask(title: task.title)
                                }
                            }
                            toast.success("Tarea eliminada", symbol: "trash.fill")
                        } content: {
                            MiDiaTaskRow(task: task) {
                                store.toggleTask(task.id)
                            }
                        }
                        .contextMenu {
                            if store.hasUserTasks {
                                Button {
                                    editingTask = task
                                } label: {
                                    Label("Editar", systemImage: "pencil")
                                }
                            }
                            Button(role: .destructive) {
                                if store.hasUserTasks {
                                    store.deleteTask(task.id)
                                } else {
                                    store.dismissDemoTask(title: task.title)
                                }
                                toast.success("Tarea eliminada", symbol: "trash.fill")
                            } label: {
                                Label("Eliminar", systemImage: "trash")
                            }
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)

                if extra > 0 {
                    Button {
                        HapticManager.shared.tap()
                        nav.openNova(segment: .acciones)
                    } label: {
                        HStack(spacing: 6) {
                            Text(extra == 1
                                 ? "Ver 1 más en Nova"
                                 : "Ver \(extra) más en Nova")
                                .font(Theme.Typography.subheadEmphasized)
                                .foregroundStyle(Theme.Colors.focusAccent)
                            Image(systemName: "arrow.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.Colors.focusAccent)
                        }
                        .padding(.vertical, Theme.Spacing.md - 2)
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.xs)
                }
            }
        }
    }

    private func pendingHeaderTrailing(count: Int) -> String {
        if count == 0 { return "Todo listo" }
        if count == 1 { return "1 pendiente" }
        return "\(count) pendientes"
    }
}

// MARK: - Próximo bloque (con contador tiempo real azul)

private struct ProximoBloqueCard: View {
    let event: FocusEvent
    /// Si está presente, mostrar opción "Editar" en el menú. Para demos es nil.
    let onEdit: (() -> Void)?
    let onDelete: () -> Void

    @State private var showDeleteConfirm: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(spacing: Theme.Spacing.sm) {
                Text(headerLabel)
                    .font(Theme.Typography.captionEmphasized)
                    .foregroundStyle(headerTint)
                    .tracking(1.2)
                Spacer()
                Text(event.timeRangeLabel)
                    .font(Theme.Typography.timestamp)
                    .foregroundStyle(Theme.Colors.textPrimary)

                // Menú overflow (· · ·) — Editar (si aplica) + Eliminar.
                Menu {
                    if let onEdit {
                        Button {
                            onEdit()
                        } label: {
                            Label("Editar", systemImage: "pencil")
                        }
                    }
                    Button(role: .destructive) {
                        onDelete()
                    } label: {
                        Label("Eliminar", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Colors.textTertiary)
                        .padding(.leading, 4)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(event.title)
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(2)
                // Contador: tick cada 1s para que los eventos EN CURSO
                // muestren minutos + segundos en tiempo real. Eventos
                // futuros y recordatorios actualizan al mismo ritmo pero
                // su texto solo cambia al cruzar minuto/hora.
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text(countdownLabel(now: context.date))
                        .font(Theme.Typography.subheadEmphasized)
                        .foregroundStyle(Theme.Colors.focusAccent)
                        .monospacedDigit()
                        .contentTransition(.numericText(countsDown: true))
                }
            }

            HStack(spacing: 6) {
                StatePill(
                    label: event.displayAsPointInTime ? "Recordatorio" : event.section.displayName,
                    tint: event.displayAsPointInTime ? Theme.Colors.sectionReminder : event.section.color,
                    symbol: event.displayAsPointInTime ? "bell.fill" : event.section.symbol
                )
                if let loc = event.location, !loc.isEmpty {
                    LocationLabel(location: loc)
                }
            }
        }
        .padding(Theme.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .strokeBorder(headerTint.opacity(0.18), lineWidth: 1)
                )
        )
        .focusCardShadow()
        .contextMenu {
            if let onEdit {
                Button(action: onEdit) {
                    Label("Editar", systemImage: "pencil")
                }
            }
            Button(role: .destructive, action: onDelete) {
                Label("Eliminar", systemImage: "trash")
            }
        }
    }

    private var headerLabel: String {
        if event.isNow { return "EN CURSO" }
        if event.displayAsPointInTime { return "RECORDATORIO" }
        return "PRÓXIMO"
    }

    private var headerTint: Color {
        if event.isNow { return Theme.Colors.success }
        if event.displayAsPointInTime { return Theme.Colors.sectionReminder }
        return Theme.Colors.focusAccent
    }

    /// Contador con segundos solo cuando el evento está EN CURSO. Recordatorios
    /// y eventos puntuales: formato absoluto humano sin segundos.
    private func countdownLabel(now: Date) -> String {
        let cal = Calendar.current
        // En curso → minutos + segundos ("Termina en 24 min 18 s")
        if !event.displayAsPointInTime,
           let end = event.endTime, event.startTime <= now && end >= now {
            let totalSeconds = max(0, Int(end.timeIntervalSince(now)))
            if totalSeconds == 0 { return "Termina ahora" }
            return "Termina en " + formatMS(seconds: totalSeconds)
        }
        let diff = event.startTime.timeIntervalSince(now)
        if diff <= 0 {
            return event.displayAsPointInTime ? "Es ahora" : "Empezó ya"
        }
        // Recordatorios y eventos sin duración explícita: formato absoluto.
        if event.displayAsPointInTime {
            let time = DateFormatters.hourMinute.string(from: event.startTime)
            if cal.isDateInToday(event.startTime) { return "Hoy a las \(time)" }
            if cal.isDateInTomorrow(event.startTime) { return "Mañana a las \(time)" }
            let day = DateFormatters.weekdayDay.string(from: event.startTime).lowercased()
            return "El \(day) a las \(time)"
        }
        // Eventos futuros con duración: "Empieza en N min" / "N h N min" (sin
        // segundos para no parpadear el texto cada segundo durante horas).
        let totalMinutes = Int(diff / 60)
        if totalMinutes == 0 { return "Empieza pronto" }
        return "Empieza en " + formatHM(minutes: totalMinutes)
    }

    /// Formato minutos + segundos para eventos EN CURSO.
    /// "5 min 42 s" / "1 min 5 s" / "42 s".
    private func formatMS(seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        var parts: [String] = []
        if h > 0 { parts.append("\(h) h") }
        if h > 0 || m > 0 { parts.append("\(m) min") }
        parts.append("\(s) s")
        return parts.joined(separator: " ")
    }

    private func formatHM(minutes: Int) -> String {
        if minutes < 60 {
            return minutes == 1 ? "1 min" : "\(minutes) min"
        }
        let h = minutes / 60
        let m = minutes % 60
        let hLabel = h == 1 ? "1 h" : "\(h) h"
        if m == 0 { return hLabel }
        return "\(hLabel) \(m) min"
    }
}

// MARK: - Timeline row

private struct TimelineEventRow: View {
    let event: FocusEvent
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            // Hora a la izquierda
            VStack(alignment: .trailing, spacing: 2) {
                Text(event.timeRangeLabel.components(separatedBy: " ").first ?? "")
                    .font(Theme.Typography.captionEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                if let dur = event.durationLabel {
                    Text(dur)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                }
            }
            .frame(width: 50, alignment: .trailing)

            // Bullet + línea
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .stroke(event.section.color.opacity(0.5), lineWidth: 1.5)
                        .frame(width: 10, height: 10)
                    Circle()
                        .fill(event.section.color)
                        .frame(width: 5, height: 5)
                }
                if !isLast {
                    Rectangle()
                        .fill(Theme.Colors.border)
                        .frame(width: 1)
                        .padding(.top, 2)
                }
            }

            // Card del evento — borde izquierdo coloreado por sección
            // (señal visual rápida del tipo) + altura/padding un poco mayor
            // para que la tarjeta respire.
            HStack(spacing: 0) {
                // Banda lateral coloreada (4pt) — visible a la izquierda.
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(event.section.color)
                    .frame(width: 4)
                    .padding(.vertical, 2)

                VStack(alignment: .leading, spacing: 6) {
                    Text(event.title)
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .lineLimit(2)

                    HStack(spacing: 4) {
                        Image(systemName: event.section.symbol)
                            .font(.system(size: 11))
                            .foregroundStyle(event.section.color)
                        Text(event.section.displayName)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                        if let loc = event.location, !loc.isEmpty {
                            Text("·").foregroundStyle(Theme.Colors.textQuaternary)
                            Text(loc)
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textTertiary)
                                .lineLimit(1)
                        }
                    }
                }
                .padding(.vertical, Theme.Spacing.md)
                .padding(.leading, Theme.Spacing.md)
                .padding(.trailing, Theme.Spacing.md)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
                    .focusCardShadow()
            )
            .padding(.bottom, isLast ? 0 : Theme.Spacing.sm)
        }
    }
}

// MARK: - Task row compacto (sin subtareas inline)

private struct MiDiaTaskRow: View {
    let task: FocusTask
    let onToggle: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.tap()
            onToggle()
        }) {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20))
                    .foregroundStyle(task.done ? Theme.Colors.success : Theme.Colors.textTertiary)

                Circle()
                    .fill(task.priority.color)
                    .frame(width: 6, height: 6)
                    .opacity(task.done ? 0.4 : 1)

                VStack(alignment: .leading, spacing: 1) {
                    Text(task.title)
                        .font(Theme.Typography.bodyEmphasized)
                        .foregroundStyle(task.done ? Theme.Colors.textTertiary : Theme.Colors.textPrimary)
                        .strikethrough(task.done, color: Theme.Colors.textTertiary)
                        .multilineTextAlignment(.leading)
                    if task.hasSubtasks {
                        Text("\(task.completedSubtaskCount)/\(task.subtasks.count) subtareas")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                    }
                }

                Spacer()
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.vertical, Theme.Spacing.sm + 2)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
                    .focusCardShadow()
            )
        }
        .buttonStyle(.plain)
    }
}
