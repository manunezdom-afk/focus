import SwiftUI

struct MiDiaView: View {
    @EnvironmentObject private var store: FocusDataStore
    @EnvironmentObject private var nav: NavigationCoordinator
    @EnvironmentObject private var toast: ToastManager
    // ScenePhase — para cancelar dictado cuando la app va a background
    // (privacy: no dejar mic activo cuando el usuario sale de la app).
    @Environment(\.scenePhase) private var scenePhase
    @State private var focusBarText: String = ""
    @State private var showAllEvents: Bool = false
    /// Servicio de dictado inline en el FocusBar. NO es Nova Live.
    /// El transcript se va metiendo en `focusBarText` mientras el usuario
    /// habla; al detener, queda listo en la barra para que revise y mande.
    @StateObject private var dictationService = NovaLiveService()
    @State private var isDictating: Bool = false
    @State private var dictationDeniedMessage: String? = nil
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

    /// Eventos visibles: del usuario si tiene, demo si NO tiene Y está en
    /// modo demo (no logueado). Una cuenta real con 0 eventos muestra vacío
    /// real — nunca eventos falsos como si fueran propios.
    /// Recordatorios vencidos van separados en `overdueReminders`.
    private var displayEvents: [FocusEvent] {
        if store.hasUserEvents {
            return store.upcomingAndCurrentEventsToday()
        }
        guard store.isInDemoMode else { return [] }
        return DemoDataProvider.shared.exampleTodayEvents()
            .filter { !store.dismissedDemoEventTitles.contains($0.title) }
    }

    /// Recordatorios cuya hora ya pasó y siguen sin "atender". Se muestran
    /// arriba en Mi Día como una fila compacta con acciones (completar /
    /// borrar / reprogramar). Solo aparecen si hay alguno — sino la
    /// sección no se renderiza.
    private var overdueReminders: [FocusEvent] {
        guard store.hasUserEvents else { return [] }
        return store.overdueRemindersToday()
    }

    /// Pendientes visibles: reales si hay, demo solo si está en modo demo
    /// (no logueado). Cuenta real con 0 tareas → vacío real.
    private var displayPendingTasks: [FocusTask] {
        if store.hasUserTasks {
            return store.pendingTodayTasks
        }
        guard store.isInDemoMode else { return [] }
        return DemoDataProvider.shared.exampleTodayTasks()
            .filter { !$0.done && !store.dismissedDemoTaskTitles.contains($0.title) }
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
                        // Padding superior MÁS generoso (xxl=24pt en vez de
                        // lg=16pt) más `safeAreaPadding(.top, sm)` abajo en el
                        // ScrollView para garantizar que el título "Mi Día"
                        // jamás quede bajo el Dynamic Island. El paging
                        // container horizontal de MainTabView puede no
                        // propagar safeArea correctamente a los children,
                        // por eso paddeamos defensivamente.
                        .padding(.top, Theme.Spacing.xxl)

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
                            },
                            onChipTap: { chip in
                                // El chip envía su texto como si el usuario
                                // hubiera escrito. Cierra la card y procesa.
                                if let send = chip.sendText {
                                    withAnimation(.easeOut(duration: 0.18)) {
                                        inlineResponse = nil
                                    }
                                    processNovaInline(text: send)
                                }
                            }
                        )
                        .padding(.horizontal, Theme.Spacing.xl)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    // Antes acá iba un `ProximoBloqueCard` con el próximo evento.
                    // Lo sacamos: duplicaba el primer item del timeline más
                    // abajo (mismo evento renderizado dos veces). Ahora el
                    // timeline es la ÚNICA fuente de verdad para los bloques
                    // de hoy — el primer item recibe un badge "PRÓXIMO" para
                    // darle presencia visual sin duplicar.

                    if !overdueReminders.isEmpty {
                        overdueRemindersSection
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
        // Mic inline: el dictation service llena focusBarText en vivo.
        // Cuando el usuario detiene (toca el mic stop) y hay transcript,
        // el texto queda en la barra listo para revisar o enviar.
        .onChange(of: dictationService.transcript) { _, newTranscript in
            // Solo escribimos al FocusBar mientras está dictando — al
            // finalizar el state pasa a idle y dejamos de hooking.
            if isDictating || dictationService.state == .listening {
                focusBarText = newTranscript
            }
        }
        .onChange(of: dictationService.state) { _, newState in
            switch newState {
            case .listening:
                isDictating = true
                dictationDeniedMessage = nil
            case .idle, .processing:
                isDictating = false
            case .denied:
                isDictating = false
                dictationDeniedMessage = "Activa el micrófono y voz en Ajustes del iPhone."
            case .error(let msg):
                isDictating = false
                dictationDeniedMessage = msg
            case .requestingPermissions:
                isDictating = false
            }
        }
        // Si el usuario cambia de tab mientras está dictando, cancelar
        // inmediatamente el mic. Sin esto el audio engine quedaba activo
        // grabando audio que el usuario no vería + audio session bloqueada
        // para otros sonidos (música, llamadas). Privacy + UX fix.
        .onChange(of: nav.selectedTab) { _, newTab in
            if isDictating && newTab != .miDia {
                dictationService.cancel()
            }
        }
        // Mismo cleanup cuando la app va a background — sin esto el mic
        // sigue activo (técnicamente iOS lo permite breve, pero es un
        // mal patrón). El scenePhase change captura background, inactive
        // y active de forma consistente.
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background && isDictating {
                dictationService.cancel()
            }
        }
        .alert("Sin permiso de voz", isPresented: .constant(dictationDeniedMessage != nil), actions: {
            Button("Abrir Ajustes") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
                dictationDeniedMessage = nil
            }
            Button("Cerrar", role: .cancel) { dictationDeniedMessage = nil }
        }, message: {
            Text(dictationDeniedMessage ?? "")
        })
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
        // El placeholder cambia a "Habla ahora…" durante el dictado para
        // dar feedback semántico sin ocupar espacio extra en pantalla.
        // El diamante de Nova en sí pulsa (glow gradient) cuando isDictating
        // = true — eso reemplaza el label flotante "Escuchando…" que antes
        // chocaba con el diseño.
        FocusBarInput(
            text: $focusBarText,
            placeholder: isDictating ? "Habla ahora…" : "Pregúntale a Nova…",
            onSubmit: {
                let text = focusBarText
                focusBarText = ""
                UIApplication.shared.sendAction(
                    #selector(UIResponder.resignFirstResponder),
                    to: nil, from: nil, for: nil
                )
                processNovaInline(text: text)
            },
            onMic: {
                HapticManager.shared.tap()
                // Mic del FocusBar = DICTADO INLINE. NO abre Nova Live,
                // NO abre sheet, NO cambia de pantalla.
                Task { await toggleInlineDictation() }
            },
            isDictating: isDictating,
            audioLevel: CGFloat(dictationService.audioLevel)
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
    /// Toggle del dictado inline. Si NO está dictando, pide permisos y
    /// arranca; el transcript llena `focusBarText` en vivo via `.onChange`.
    /// Si YA está dictando, lo detiene — el texto queda en la barra para
    /// que el usuario revise y mande con el botón enviar.
    private func toggleInlineDictation() async {
        if isDictating {
            dictationService.stop()
            return
        }
        // Limpiar transcript previo si el usuario va a empezar de cero.
        // Si quería dictar después de un texto que ya escribió, se respeta.
        let auth = await dictationService.currentAuthorizationStatus()
        switch auth {
        case .authorized:
            await dictationService.start()
        case .notDetermined:
            if await dictationService.requestAuthorization() {
                await dictationService.start()
            }
        case .denied:
            dictationDeniedMessage = "Activa el micrófono y voz en Ajustes del iPhone para usar el dictado."
        }
    }

    private func processNovaInline(text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        HapticManager.shared.tap()

        // Loading inmediato — el usuario ve la card "processing" mientras se
        // decide el path (local o remoto). Copy humano, no técnico.
        withAnimation(.easeInOut(duration: 0.18)) {
            inlineResponse = InlineNovaResponse(
                userText: trimmed,
                summary: "Nova está ordenando esto…",
                isLoading: true,
                tone: .processing
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
    /// final. Estrategia:
    /// 1. Pre-parse local (cheap). Si el intent requiere contexto del cliente
    ///    (correcciones al último ítem, follow-up de pending, comandos meta),
    ///    se short-circuit y NO se llama al backend — el backend no tiene
    ///    el `lastEventId` ni el pending, así que no podría resolverlos.
    /// 2. Si el local diría clarify con título, guardar pending preventivo
    ///    para que el siguiente turno corto se pueda completar localmente
    ///    aunque el backend haya respondido.
    /// 3. Llamar backend con accessToken; fallback local en errores recuperables.
    private func resolveNovaResponse(for trimmed: String) async -> InlineNovaResponse {
        let preIntent = NovaResponder.parse(trimmed, context: store.novaContext)

        // 1. Short-circuit: intents que requieren contexto local que el
        //    backend no tiene (corrige/borra último ítem, follow-up
        //    pending resuelto, comandos meta del cliente).
        if shouldShortCircuit(preIntent) {
            return executeIntent(preIntent, userText: trimmed)
        }

        // 2. Save pending preventivo si local diría clarify con título.
        if case .clarify(let reason) = preIntent,
           let pending = buildPendingClarification(
               from: reason,
               userText: trimmed,
               source: .inlineMiDia
           ) {
            store.setPendingClarification(pending)
        }

        // 3. Sin sesión activa → parser local directo. No mostramos nota
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

    /// True cuando el intent local SIEMPRE es mejor que el backend porque
    /// requiere contexto cliente o porque el backend lo entendería peor.
    /// Conservador: solo cubre casos donde tenemos alta confianza.
    private func shouldShortCircuit(_ intent: NovaIntent) -> Bool {
        switch intent {
        case .correctLastEvent, .deleteLastItem, .convertLastToTask:
            // Corrige/borra el último ítem usando `lastEventId`/`lastTaskId`
            // del contexto local. Backend no tiene esos ids.
            return true
        case .organizeDay, .reviewPending, .askAboutDemo:
            // Comandos meta del cliente — generan suggestions/listados locales,
            // no requieren NLU del backend.
            return true
        case .smallTalk:
            // Confirmaciones/cancelaciones cortas que el local ya resolvió.
            return true
        case .createEvent, .createTask:
            // Solo si el local resolvió un follow-up con pending activo —
            // significa que estaba completando una pregunta previa.
            return store.novaContext.pendingIsActive
        default:
            return false
        }
    }

    /// Aplica el `NovaService.Result` al store y arma el inline response.
    /// Si el backend solo devolvió `reply` sin actions (clarify o smalltalk),
    /// mostramos solo el texto. ADEMÁS: si el reply termina con "?", lo
    /// tratamos como pregunta del backend y guardamos un pending
    /// clarification basado en el texto del usuario — así el siguiente
    /// turno corto ("a las 3", "mañana", "en 20") puede completar la
    /// acción aunque el local parser no haya detectado clarify.
    private func applyBackendResult(_ result: NovaService.Result, userText: String) async -> InlineNovaResponse {
        let outcome = store.applyBackendActions(result.actions, userText: userText)

        let replyText = result.reply.trimmingCharacters(in: .whitespacesAndNewlines)
        // Cuota de smart actions agotada: pegar nota humana al final.
        let blockedNote: String? = result.smartActionsBlocked
            ? (result.smartActionsMessage ?? "Llegaste al límite diario de acciones de Nova.")
            : nil

        // Si el backend NO mutó nada y su reply es una pregunta, guardar
        // pending basado en el original userText. Esto cubre casos como
        // "tengo parcial el jueves" donde el local parser sí entiende y
        // armó pending, pero también casos donde el backend hace una
        // pregunta no anticipada por el local. Idempotente: si el local
        // ya guardó un pending, este no lo sobreescribe a peor.
        if !outcome.didMutate, replyText.hasSuffix("?")
            && !store.novaContext.pendingIsActive {
            persistBackendQuestionAsPending(userText: userText, question: replyText)
        }

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

    /// Corre el parser local y arma el inline response. Soporta frases
    /// compuestas: si el parser detecta múltiples intents (conectores
    /// "y luego", "luego", "después", "también"...), ejecuta cada uno y
    /// combina los resúmenes. Si la nota viene dada, la agrega al final.
    private func runLocalFallback(for trimmed: String, withNote note: String?) -> InlineNovaResponse {
        let intents = NovaResponder.parseAll(trimmed, context: store.novaContext)

        // Caso simple: un solo intent → comportamiento idéntico al anterior.
        if intents.count <= 1 {
            let intent = intents.first ?? .clarify(reason: .noContext)
            var response = executeIntent(intent, userText: trimmed)
            if let note {
                response.details = [response.details, note].compactMap { $0 }.joined(separator: "\n\n")
            }
            return response
        }

        // Multi-intent: ejecutar cada intent (side effects: addEvent/addTask)
        // y luego componer UN SOLO summary humano que enumere lo que se hizo.
        // El resumen anterior ("Evento agregado a Calendario · Evento agregado a
        // Calendario") era confuso — no decía qué se creó, repetía info, y
        // tenía clasificación errónea.
        var createdItems: [CreatedItem] = []
        var lastAction: InlineNovaAction? = nil

        for intent in intents {
            let resp = executeIntent(intent, userText: trimmed)
            guard !resp.isError else { continue }
            if lastAction == nil { lastAction = resp.action }
            if let item = CreatedItem(intent: intent, userText: trimmed) {
                createdItems.append(item)
            }
        }

        if createdItems.isEmpty {
            // Nada se creó — no guardar basura. Pedir separación manual.
            return InlineNovaResponse(
                userText: trimmed,
                summary: "Entendí varias cosas pero no logré separarlas con confianza.",
                details: "Prueba enviándolas por separado.",
                isError: true
            )
        }

        let (summary, details) = composeMultiIntentMessage(items: createdItems)
        let combinedDetails: String? = {
            let parts = [details, note].compactMap { $0 }.filter { !$0.isEmpty }
            return parts.isEmpty ? nil : parts.joined(separator: "\n\n")
        }()
        return InlineNovaResponse(
            userText: trimmed,
            summary: summary,
            details: combinedDetails,
            action: lastAction
        )
    }

    /// Estructura interna para describir lo que se creó tras ejecutar cada
    /// intent del multi-intent. Nos permite componer un resumen humano
    /// agrupando por tipo y día.
    ///
    /// **Modelo unificado**: bajo el nuevo criterio "todo con hora = bloque",
    /// ya no separamos visualmente "recordatorio" vs "evento" en Mi Día.
    /// `kind` se queda como `.block` (tiene hora) o `.task` (no la tiene).
    /// El offset de aviso anticipado va en `reminderOffsetMinutes` del
    /// mismo bloque, no como ítem aparte.
    private struct CreatedItem {
        enum Kind { case block, task }
        let kind: Kind
        let title: String
        let date: Date?
        /// Si el usuario dijo "acuérdame N min antes", se persiste como
        /// metadata del bloque y se renderiza como chip 🔔 dentro del
        /// mismo ítem en Mi Día.
        let reminderOffsetMinutes: Int?

        init?(intent: NovaIntent, userText: String) {
            switch intent {
            case let .createEvent(rawTitle, when, _, _, _, _):
                let cleaned = NovaActionNormalizer.cleanTitle(rawTitle)
                guard !cleaned.isEmpty else { return nil }
                self.kind = .block
                self.title = cleaned
                self.date = when
                self.reminderOffsetMinutes = NovaActionNormalizer.extractReminderOffset(from: userText)
            case let .createTask(rawTitle, dueDate, _, _):
                let cleaned = NovaActionNormalizer.cleanTitle(rawTitle)
                guard !cleaned.isEmpty else { return nil }
                self.kind = .task
                self.title = cleaned
                self.date = dueDate
                self.reminderOffsetMinutes = nil
            default:
                return nil
            }
        }
    }

    /// Convierte los items creados en (summary, details) humanos.
    /// Bajo el modelo unificado, todo lo que tiene hora es un "bloque" en
    /// Mi Día — el offset de aviso se muestra como chip dentro del mismo
    /// bloque, no como tarjeta aparte.
    ///
    /// Ejemplos:
    /// - 2 bloques mismo día → "Listo. Te dejé 2 bloques para hoy: …"
    /// - 1 bloque + 1 tarea → "Listo. Te dejé 1 bloque y 1 tarea."
    /// - 1 tarea sola → no debería pasar (count == 1 va por path simple).
    private func composeMultiIntentMessage(items: [CreatedItem]) -> (String, String?) {
        let blocks = items.filter { $0.kind == .block }
        let tasks  = items.filter { $0.kind == .task }

        // Detectar si todos los items con fecha caen en el mismo día → "para hoy/mañana/...".
        let allDates = items.compactMap { $0.date }
        let cal = Calendar.current
        let sameDay: Bool = {
            guard let first = allDates.first else { return false }
            return allDates.allSatisfy { cal.isDate($0, inSameDayAs: first) }
        }()
        let dayLabel: String? = {
            guard sameDay, let date = allDates.first else { return nil }
            if cal.isDateInToday(date) { return "hoy" }
            if cal.isDateInTomorrow(date) { return "mañana" }
            return DateFormatters.weekdayDay.string(from: date).lowercased()
        }()

        // Summary: header humano. "Bloque" cuando tiene hora, "tarea" sino.
        let header: String
        let dayBit = dayLabel.map { " para \($0)" } ?? ""
        switch (blocks.count, tasks.count) {
        case (let b, 0) where b >= 2:
            header = "Listo. Te dejé \(b) bloques\(dayBit)."
        case (0, let t) where t >= 2:
            header = "Listo. Anoté \(t) tareas\(dayBit)."
        default:
            // Mixed.
            var parts: [String] = []
            if blocks.count > 0 { parts.append("\(blocks.count) bloque\(blocks.count == 1 ? "" : "s")") }
            if tasks.count > 0  { parts.append("\(tasks.count) tarea\(tasks.count == 1 ? "" : "s")") }
            let combined = parts.joined(separator: " y ")
            header = "Listo. Te dejé \(combined)\(dayBit)."
        }

        // Details: bullets ordenados por hora. Si el item tiene reminder
        // offset, lo incluimos en el mismo bullet — sin duplicar como ítem
        // aparte.
        let sorted = items.sorted { a, b in
            switch (a.date, b.date) {
            case let (l?, r?): return l < r
            case (_?, nil):    return true
            case (nil, _?):    return false
            default:           return false
            }
        }
        let bullets = sorted.map { item -> String in
            let hh = item.date.map { DateFormatters.hourMinute.string(from: $0) }
            var line: String
            switch (hh, sameDay) {
            case let (.some(time), true):
                line = "• \(item.title) — \(time)"
            case let (.some(time), false):
                if let d = item.date {
                    let day = cal.isDateInToday(d) ? "hoy"
                        : cal.isDateInTomorrow(d) ? "mañana"
                        : DateFormatters.weekdayDay.string(from: d).lowercased()
                    line = "• \(item.title) — \(day) \(time)"
                } else {
                    line = "• \(item.title) — \(time)"
                }
            case (.none, _):
                line = "• \(item.title)"
            }
            if let mins = item.reminderOffsetMinutes {
                let offsetLabel = mins < 60
                    ? "\(mins) min antes"
                    : (mins % 60 == 0 ? "\(mins/60) h antes" : "\(mins/60) h \(mins%60) min antes")
                line += "  🔔 \(offsetLabel)"
            }
            return line
        }
        let details = bullets.isEmpty ? nil : bullets.joined(separator: "\n")
        return (header, details)
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
    /// Estado técnico va solo a console.log, NO a la UI principal.
    private func humanFallbackNote(for error: NovaServiceError) -> String? {
        switch error {
        case .unauthorized:
            return "Tu sesión expiró. Vuelve a iniciar sesión cuando puedas."
        case .quotaExceeded(let message):
            return message
        case .offline:
            return "Sin conexión. Tus cambios quedan locales hasta que vuelvas a tener internet."
        case .timeout, .serviceUnavailable, .badLLMOutput, .network,
             .server, .invalidResponse, .encoding, .decoding:
            // Antes mostrábamos "Nova avanzada no respondió bien. Lo
            // resolví en modo local." → técnico y alarmante. Si el
            // fallback local logró ejecutar las acciones (resumen no
            // vacío), el usuario NO necesita ver una nota de error —
            // el `summary` ya le dice qué se hizo. Para los pocos casos
            // donde el local tampoco entendió, el caller muestra una
            // pregunta humana por separado. NO devolvemos nada acá.
            return nil
        default:
            return nil
        }
    }

    /// Split del reply del backend en (summary, details). El backend ya
    /// devuelve máx 2 oraciones; si hay punto final, lo partimos ahí.
    /// Llamado cuando el backend retorna una pregunta sin actions. Re-parsea
    /// el `userText` localmente para extraer título/fecha tentativos y los
    /// guarda en `pendingClarification`. Así el siguiente turno corto puede
    /// completar la acción usando memoria local — aunque el backend nunca
    /// emita un "clarify" estructurado.
    private func persistBackendQuestionAsPending(userText: String, question: String) {
        // Re-parsear local para obtener intent y construir pending.
        let preIntent = NovaResponder.parse(userText, context: store.novaContext)
        if case .clarify(let reason) = preIntent,
           let pending = buildPendingClarification(
               from: reason,
               userText: userText,
               source: .inlineMiDia
           ) {
            // Sobreescribir el questionAsked con la pregunta REAL del
            // backend para que sea coherente con lo que el usuario está
            // viendo.
            var updated = pending
            updated.questionAsked = question
            store.setPendingClarification(updated)
            return
        }
        // Si el local parser no detectó clarify, hacemos un pending
        // genérico con title=userText (limpio) — el follow-up tendrá
        // que aportar la hora. Mejor algo que nada.
        let cleanedTitle = NovaActionNormalizer.cleanTitle(userText)
        guard !cleanedTitle.isEmpty else { return }
        let wantsReminder = NovaActionNormalizer.isReminderTrigger(in: userText)
        store.setPendingClarification(PendingClarification(
            originalInput: userText,
            kind: wantsReminder ? .reminder : .event,
            proposedTitle: cleanedTitle,
            proposedDate: nil,
            proposedSection: NovaResponder.guessSection(for: userText),
            wantsReminder: wantsReminder,
            missingFields: [.date, .time],
            questionAsked: question,
            source: .inlineMiDia
        ))
    }

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
            // Pipeline unificado con `applyLocalNovaIntent` del store:
            //   1) Si hay endTime explícito (rango "de X a Y") → respetarlo
            //      siempre, AUNQUE además el usuario haya dicho "acuérdame N
            //      antes". El chip de offset va dentro del MISMO bloque, no
            //      duplica el evento.
            //   2) Si NO hay endTime y wantsReminder → punto en tiempo,
            //      duración interna 5 min para ordenamiento, isReminder=true.
            //   3) Si NO hay endTime y no es reminder → inferredDuration=true,
            //      la UI lo muestra como punto puntual.
            let endResolution = NovaActionNormalizer.resolveEndTime(
                startTime: date,
                providedEndTime: explicitEnd,
                hasExplicitEndTime: explicitEnd != nil && (explicitEnd ?? date) > date,
                isReminder: wantsReminder
            )
            let end: Date
            let isReminderFlag: Bool?
            let inferredFlag: Bool?
            if let resolved = endResolution.endTime {
                // Rango explícito (con o sin "acuérdame antes").
                end = resolved
                isReminderFlag = nil
                inferredFlag = false
            } else if wantsReminder {
                end = cal.date(byAdding: .minute, value: 5, to: date) ?? date
                isReminderFlag = true
                inferredFlag = nil
            } else {
                end = cal.date(byAdding: .minute, value: 5, to: date) ?? date
                isReminderFlag = nil
                inferredFlag = endResolution.inferredDuration
            }

            let effectiveSection: EventSection
            if wantsReminder {
                effectiveSection = section ?? .reminder
            } else {
                effectiveSection = section
                    ?? NovaResponder.guessSection(for: title)
                    ?? .personal
            }
            // Reminder offset SIEMPRE se extrae si está en userText, sin
            // importar si es recordatorio puntual o evento con duración.
            // Antes solo se pasaba en el path remote → el chip 🔔 nunca
            // aparecía en eventos creados localmente.
            let extractedOffsets: [Int]?
            if let mins = NovaActionNormalizer.extractReminderOffset(from: userText) {
                extractedOffsets = [mins]
            } else {
                extractedOffsets = nil
            }
            let event = FocusEvent(
                title: title,
                startTime: date,
                endTime: end,
                section: effectiveSection,
                location: location,
                isReminder: isReminderFlag,
                inferredDuration: inferredFlag,
                reminderOffsets: extractedOffsets
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
            // Copy unificado para el usuario: "bloque" en vez de mezclar
            // "recordatorio"/"evento". Si hay offset, se menciona.
            var detail = "\(dayLabel) · \(timeLabel)"
            if let loc = location { detail += " · \(loc)" }
            if let mins = extractedOffsets?.first {
                let offsetLabel = mins < 60
                    ? "\(mins) min antes"
                    : (mins % 60 == 0 ? "\(mins/60) h antes" : "\(mins/60) h \(mins%60) min antes")
                detail += " · 🔔 \(offsetLabel)"
            }
            return InlineNovaResponse(
                userText: userText,
                summary: "Listo. Te dejé «\(title)» en Mi Día.",
                details: detail,
                action: .openCalendar,
                tone: .success
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
            // Quick chips por razón — el usuario puede completar con un tap
            // en lugar de escribir. Solo se muestran en estado `.clarify`.
            return InlineNovaResponse(
                userText: userText,
                summary: clarifyHeadline(reason),
                details: clarifyDetail(reason),
                action: nil,
                isError: false,
                tone: .clarify,
                quickChips: chipsFor(reason: reason)
            )
        }
    }

    /// Devuelve chips de respuesta rápida sugeridos según el motivo del
    /// clarify. Diseñados para que el usuario complete con un tap:
    ///   - eventNeedsTime: "9:00", "12:00", "15:00", "Editar".
    ///   - eventNeedsDateTime: "Hoy 12:00", "Mañana 9:00", "Editar".
    ///   - taskNeedsTitle / eventNeedsTitle / noContext / unclear: ninguno.
    private func chipsFor(reason: NovaIntent.ClarifyReason) -> [NovaQuickChip] {
        switch reason {
        case .eventNeedsTime:
            return [
                NovaQuickChip(label: "9:00", sendText: "a las 9"),
                NovaQuickChip(label: "12:00", sendText: "a las 12"),
                NovaQuickChip(label: "15:00", sendText: "a las 15"),
                NovaQuickChip(label: "18:00", sendText: "a las 18")
            ]
        case .eventNeedsDateTime:
            return [
                NovaQuickChip(label: "Hoy 12:00", sendText: "hoy a las 12"),
                NovaQuickChip(label: "Hoy 18:00", sendText: "hoy a las 18"),
                NovaQuickChip(label: "Mañana 9:00", sendText: "mañana a las 9")
            ]
        default:
            return []
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
        // Detección de "quiero recordatorio" — usaba `contains("acu")` que
        // generaba falsos positivos en palabras como "acudir", "acumular",
        // "acuse". Ahora se delega a la utilidad central que chequea
        // triggers explícitos ("acuérdame", "recuérdame", "avísame", etc.)
        // con word boundaries.
        let wantsReminder = NovaActionNormalizer.isReminderTrigger(in: userText)
            || NovaActionNormalizer.impliesPunctualReminder(in: userText)
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

    // MARK: - Vencidos

    /// Sección "Vencidos" — recordatorios que ya pasaron y siguen sin
    /// atender. Se muestra entre el header de Mi Día y el timeline para
    /// que el usuario los vea primero. Compacta — cada uno con título,
    /// hora vencida, y acciones (reprogramar +5 min / borrar).
    @ViewBuilder
    private var overdueRemindersSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack(spacing: 6) {
                Image(systemName: "bell.slash.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Colors.warning)
                Text("Vencidos")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Colors.warning)
                    .tracking(0.8)
                    .textCase(.uppercase)
            }
            VStack(spacing: Theme.Spacing.xs) {
                ForEach(overdueReminders.prefix(3)) { reminder in
                    overdueReminderRow(reminder)
                }
            }
        }
    }

    private func overdueReminderRow(_ event: FocusEvent) -> some View {
        let timeLabel = DateFormatters.hourMinute.string(from: event.startTime)
        let elapsed = Int(Date().timeIntervalSince(event.startTime) / 60)
        let ago = elapsed < 60
            ? "hace \(max(elapsed, 1)) min"
            : "hace \(elapsed / 60) h"
        return HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "clock.badge.exclamationmark")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Colors.warning)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .font(Theme.Typography.bodyEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(1)
                Text("\(timeLabel) · \(ago)")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
            Spacer()
            // Reprogramar a "ahora + 5 min" como atajo rápido.
            Button {
                HapticManager.shared.tick()
                reschedule(event, addingMinutes: 5)
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.focusAccent)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Theme.Colors.focusAccentSoft))
            }
            .buttonStyle(.plain)
            // Borrar = "ya pasó, no me importa".
            Button {
                HapticManager.shared.tap()
                store.deleteEvent(event.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Theme.Colors.surfaceHigh))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                        .strokeBorder(Theme.Colors.warning.opacity(0.30), lineWidth: 1)
                )
        )
    }

    /// Reprograma un recordatorio sumando minutos desde "ahora". Triggers
    /// re-schedule de la notificación automáticamente via updateEvent.
    private func reschedule(_ event: FocusEvent, addingMinutes: Int) {
        var updated = event
        let newStart = Date().addingTimeInterval(TimeInterval(addingMinutes * 60))
        updated.startTime = newStart
        // Mantener punto en el tiempo (5 min de duración interna como antes).
        updated.endTime = newStart.addingTimeInterval(5 * 60)
        store.updateEvent(updated)
    }

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
                // Densidad del timeline: spacious con 1-2 eventos (más
                // presencia vertical, fonts más grandes), balanced con
                // 3-5, compact con 6+. Adapta el ritmo visual al día.
                let density = TimelineRowDensity.of(eventCount: displayEvents.count)

                VStack(spacing: density.rowSpacing) {
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
                                isLast: idx == shown.count - 1 && hiddenCount == 0,
                                density: density,
                                isNext: idx == 0
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

// MARK: - Timeline row

/// Densidad visual del timeline — se adapta al número de eventos del día.
/// Cuando hay pocos eventos (1-2), las cards crecen para llenar el espacio
/// con presencia. Con muchos eventos, se compactan para que quepan sin
/// hacer scroll excesivo.
enum TimelineRowDensity {
    case spacious   // 1-2 eventos — cards grandes, mucho aire
    case balanced   // 3-5 eventos — layout normal
    case compact    // 6+ eventos — compactado para densidad

    var verticalPadding: CGFloat {
        switch self {
        case .spacious: return Theme.Spacing.lg + 4   // ~22
        case .balanced: return Theme.Spacing.md       // ~12
        case .compact:  return Theme.Spacing.sm       // ~8
        }
    }

    var titleFont: Font {
        switch self {
        case .spacious: return .system(size: 22, weight: .semibold)
        case .balanced: return Theme.Typography.bodyBold
        case .compact:  return Theme.Typography.subheadEmphasized
        }
    }

    var rowSpacing: CGFloat {
        switch self {
        case .spacious: return Theme.Spacing.lg
        case .balanced: return Theme.Spacing.md
        case .compact:  return Theme.Spacing.sm
        }
    }

    var sidebarWidth: CGFloat {
        switch self {
        case .spacious: return 5
        case .balanced: return 4
        case .compact:  return 3
        }
    }

    var metaFont: Font {
        switch self {
        case .spacious: return Theme.Typography.subhead
        case .balanced: return Theme.Typography.caption
        case .compact:  return Theme.Typography.caption
        }
    }

    static func of(eventCount n: Int) -> TimelineRowDensity {
        if n <= 2 { return .spacious }
        if n <= 5 { return .balanced }
        return .compact
    }
}

private struct TimelineEventRow: View {
    let event: FocusEvent
    let isLast: Bool
    var density: TimelineRowDensity = .balanced
    /// True cuando este es el primer evento upcoming del día — se muestra
    /// un mini badge "PRÓXIMO" para darle presencia visual sin necesitar
    /// una card duplicada (la antigua ProximoBloqueCard).
    var isNext: Bool = false

    /// Chip de recordatorio anticipado. Si el evento tiene
    /// `reminderOffsets = [40]` mostramos "🔔 40 min antes" dentro del
    /// mismo bloque — antes era una tarjeta separada que duplicaba
    /// visualmente el evento.
    private var primaryReminderOffsetMinutes: Int? {
        guard let offsets = event.reminderOffsets, !offsets.isEmpty else { return nil }
        return offsets.first
    }

    private var reminderChipLabel: String? {
        guard let m = primaryReminderOffsetMinutes else { return nil }
        let extraCount = (event.reminderOffsets?.count ?? 0) - 1
        let base: String
        if m < 60 {
            base = "\(m) min antes"
        } else if m == 60 {
            base = "1 h antes"
        } else if m % 60 == 0 {
            base = "\(m / 60) h antes"
        } else {
            let h = m / 60
            let mm = m % 60
            base = "\(h) h \(mm) min antes"
        }
        return extraCount > 0 ? "\(base) (+\(extraCount))" : base
    }

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            // Hora a la izquierda
            VStack(alignment: .trailing, spacing: 2) {
                Text(event.timeRangeLabel.components(separatedBy: " ").first ?? "")
                    .font(density == .spacious
                          ? .system(size: 13, weight: .semibold)
                          : Theme.Typography.captionEmphasized)
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
                        .frame(width: density == .spacious ? 12 : 10,
                               height: density == .spacious ? 12 : 10)
                    Circle()
                        .fill(event.section.color)
                        .frame(width: density == .spacious ? 6 : 5,
                               height: density == .spacious ? 6 : 5)
                }
                if !isLast {
                    Rectangle()
                        .fill(Theme.Colors.border)
                        .frame(width: 1)
                        .padding(.top, 2)
                }
            }

            // Card del evento — banda lateral coloreada por sección que
            // sigue la curva del card. Truco: la banda es un Rectangle
            // simple ancho (sin cornerRadius) y se recorta junto con todo
            // el HStack via .clipShape con el cornerRadius del card.
            HStack(spacing: 0) {
                Rectangle()
                    .fill(event.section.color)
                    .frame(width: density.sidebarWidth)

                VStack(alignment: .leading, spacing: density == .spacious ? 8 : 6) {
                    // Badge "PRÓXIMO" + título. El badge solo aparece en el
                    // primer evento upcoming del día — reemplaza la antigua
                    // ProximoBloqueCard sin duplicar el contenido.
                    if isNext && !event.isNow {
                        Text("PRÓXIMO")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Theme.Colors.focusAccent)
                            .tracking(1.2)
                    } else if event.isNow {
                        Text("EN CURSO")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Theme.Colors.success)
                            .tracking(1.2)
                    }
                    Text(event.title)
                        .font(density.titleFont)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .lineLimit(2)

                    HStack(spacing: 4) {
                        Image(systemName: event.section.symbol)
                            .font(.system(size: density == .spacious ? 12 : 11))
                            .foregroundStyle(event.section.color)
                        Text(event.section.displayName)
                            .font(density.metaFont)
                            .foregroundStyle(Theme.Colors.textTertiary)
                        if let loc = event.location, !loc.isEmpty {
                            Text("·").foregroundStyle(Theme.Colors.textQuaternary)
                            Text(loc)
                                .font(density.metaFont)
                                .foregroundStyle(Theme.Colors.textTertiary)
                                .lineLimit(1)
                        }
                    }

                    // Chip recordatorio anticipado — "🔔 40 min antes". Aparece
                    // DENTRO del mismo bloque, no como card separada arriba.
                    // Misma regla para eventos puntuales con offset y eventos
                    // con duración con offset.
                    if let chipLabel = reminderChipLabel {
                        HStack(spacing: 4) {
                            Image(systemName: "bell.fill")
                                .font(.system(size: density == .spacious ? 11 : 10, weight: .semibold))
                                .foregroundStyle(Theme.Colors.sectionReminder)
                            Text(chipLabel)
                                .font(density.metaFont)
                                .foregroundStyle(Theme.Colors.sectionReminder)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(
                            Capsule().fill(Theme.Colors.sectionReminder.opacity(0.12))
                        )
                    }

                    // Contador live solo si: evento EN CURSO o empieza en
                    // < 60 min. Más allá de eso, el tick por segundo es
                    // ruido visual sin valor.
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        if let label = inlineCountdownLabel(now: context.date) {
                            Text(label)
                                .font(density.metaFont)
                                .foregroundStyle(event.isNow
                                    ? Theme.Colors.success
                                    : Theme.Colors.focusAccent)
                                .monospacedDigit()
                                .contentTransition(.numericText(countsDown: true))
                        }
                    }
                }
                .padding(.vertical, density.verticalPadding)
                .padding(.leading, Theme.Spacing.md)
                .padding(.trailing, Theme.Spacing.md)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                // En modo spacious (1-2 eventos), un gradient sutil del color
                // de la sección a surface para que la card tenga atmósfera
                // y se sienta hero. En balanced/compact, solo surface plano.
                Group {
                    if density == .spacious {
                        LinearGradient(
                            colors: [
                                event.section.color.opacity(0.10),
                                Theme.Colors.surface
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    } else {
                        Theme.Colors.surface
                    }
                }
            )
            // Recortamos TODO el HStack (banda + contenido + fondo) con el
            // mismo cornerRadius — así la banda lateral termina en curva
            // exactamente como la card, no recta.
            .clipShape(
                RoundedRectangle(cornerRadius: density == .spacious ? Theme.Radius.lg : Theme.Radius.md, style: .continuous)
            )
            .overlay(
                // El border va por fuera del clip para que se vea limpio
                // en las esquinas redondeadas.
                RoundedRectangle(cornerRadius: density == .spacious ? Theme.Radius.lg : Theme.Radius.md, style: .continuous)
                    .strokeBorder(
                        density == .spacious
                            ? event.section.color.opacity(0.25)
                            : Theme.Colors.border,
                        lineWidth: density == .spacious ? 1.2 : Theme.Stroke.hairline
                    )
            )
            .focusCardShadow()
            .padding(.bottom, isLast ? 0 : Theme.Spacing.sm)
        }
    }

    /// Genera la etiqueta de countdown SOLO para eventos relevantes:
    /// - EN CURSO (entre startTime y endTime): "Termina en MM min SS s".
    /// - PRÓXIMO IMINENTE (start futuro, < 60 min): "Empieza en MM min SS s".
    /// - Más lejano o pasado: devuelve nil → no se renderiza la línea.
    /// Esto evita que TODOS los eventos del día parpadeen cada segundo.
    private func inlineCountdownLabel(now: Date) -> String? {
        // En curso: contamos lo que falta hasta endTime (si hay).
        if !event.displayAsPointInTime,
           let end = event.endTime,
           event.startTime <= now && end >= now {
            let s = max(0, Int(end.timeIntervalSince(now)))
            if s == 0 { return "Termina ahora" }
            return "Termina en " + Self.formatMS(seconds: s)
        }
        // Próximo en menos de una hora: minutos + segundos.
        let diff = event.startTime.timeIntervalSince(now)
        if diff > 0 && diff <= 3600 {
            let s = Int(diff)
            if event.displayAsPointInTime {
                return "En " + Self.formatMS(seconds: s)
            }
            return "Empieza en " + Self.formatMS(seconds: s)
        }
        return nil
    }

    private static func formatMS(seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        var parts: [String] = []
        if h > 0 { parts.append("\(h) h") }
        if h > 0 || m > 0 { parts.append("\(m) min") }
        parts.append("\(s) s")
        return parts.joined(separator: " ")
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
