import SwiftUI

/// Nova como tab principal. Tres segmentos internos:
/// - **Bandeja** (default): cards de decisiones de Nova con Aprobar/Posponer/Descartar.
/// - **Acciones**: 6 quick actions para arrancar conversaciones útiles (organizar
///   día, crear tarea, revisar pendientes, etc).
/// - **Chat**: conversación libre con Nova como segunda capa.
///
/// Por diseño, Nova NO es solo un chat: aterrizar en Bandeja deja al usuario
/// frente a decisiones concretas, no frente a un cursor parpadeando.
struct NovaView: View {
    @EnvironmentObject private var store: FocusDataStore
    @EnvironmentObject private var nav: NavigationCoordinator
    @EnvironmentObject private var toast: ToastManager
    @EnvironmentObject private var coachMarks: CoachMarksStore

    @State private var draft: String = ""
    @State private var showCreateTask: Bool = false
    @State private var showCreateEvent: Bool = false
    @State private var showImportCalendar: Bool = false
    @State private var showExportCalendar: Bool = false
    @State private var showNovaLive: Bool = false
    @State private var showVoiceDictation: Bool = false
    @FocusState private var inputFocused: Bool

    /// **Feature flag Nova Live**. La V1 actual (Speech framework + STT
    /// + envío a Nova) NO es la experiencia conversacional tipo
    /// ChatGPT/Gemini Live que querríamos para beta — es esencialmente
    /// dictado + procesamiento posterior. Para no enviar una experiencia
    /// de voz que se sienta a medias, ocultamos la entrada por chip en
    /// el empty state del chat. El código de `NovaLiveView` +
    /// `NovaLiveService` Live mode queda compilado pero inalcanzable
    /// desde la UI.
    ///
    /// Para reactivar cuando se implemente realtime real (OpenAI Realtime
    /// API o equivalente con backend seguro para mintear ephemeral
    /// tokens), flipear este flag a `true`. El roadmap está documentado
    /// en FOCUS_AUDIT_MASTER.md.
    private static let isNovaLiveEnabled = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Theme 2.0 v4: ambient canvas animado tipo Gemini, mismo
                // componente que Mi Día. Estado .thinking cuando Nova está
                // tecleando una respuesta — los halos se intensifican,
                // como si la IA "respirara" su procesamiento. .idle el
                // resto. Reemplaza el RadialGradient estático que era el
                // top + Theme.Colors.background.
                FocusAmbientCanvas(state: store.isNovaTyping ? .thinking : .idle)

                VStack(spacing: 0) {
                    branding
                        .padding(.horizontal, Theme.Spacing.xl)
                        // `.lg` para consistencia con Mi Día/Ajustes y aire
                        // suficiente respecto al notch/Dynamic Island.
                        .padding(.top, Theme.Spacing.lg)

                    segmentedControl
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.top, Theme.Spacing.lg)
                        .padding(.bottom, Theme.Spacing.md)

                    Group {
                        switch nav.novaSegment {
                        case .bandeja:  bandejaContent
                        case .acciones: accionesContent
                        case .chat:     chatContent
                        }
                    }
                }
            }
            .navigationBarHidden(true)
        }
        // Coach mark de Nova la primera vez que el usuario llega a esta
        // tab. Mismo patrón que Mi Día y Calendario.
        .task(id: nav.selectedTab) {
            if nav.selectedTab == .nova {
                try? await Task.sleep(nanoseconds: 500_000_000)
                coachMarks.presentIfNeeded(.nova)
            }
        }
        .sheet(isPresented: $showCreateTask) {
            NuevaTareaSheet { task in
                store.addTask(task)
                toast.success("Tarea creada")
            }
            .presentationDetents([.medium])
            .presentationBackground(Theme.Colors.background)
        }
        .sheet(isPresented: $showCreateEvent) {
            NuevoEventoSheet(initialDate: Date()) { event in
                store.addEvent(event)
                toast.success("Evento creado")
            }
            .presentationDetents([.medium, .large])
            .presentationBackground(Theme.Colors.background)
        }
        .sheet(isPresented: $showImportCalendar) {
            ComingSoonSheet(
                title: "Importar calendario",
                message: "Próximamente podrás traer eventos desde Google Calendar, Apple Calendar o un archivo .ics. Nova te ayudará a ordenarlos, detectar conflictos y dejar bloques de foco entre medio.",
                icon: "square.and.arrow.down",
                iconTint: Theme.Colors.novaAccent,
                secondaryAction: (label: "Crear evento manual", action: {
                    showCreateEvent = true
                })
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showExportCalendar) {
            ComingSoonSheet(
                title: "Exportar calendario",
                message: "Próximamente podrás sacar tu agenda como archivo .ics o sincronizar de vuelta a Google/Apple Calendar. Por ahora todo se guarda local en tu iPhone.",
                icon: "square.and.arrow.up",
                iconTint: Theme.Colors.novaAccent
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showNovaLive) {
            NovaLiveView { transcript in
                // Misma puerta de entrada que el input escrito del chat.
                // Backend o fallback local + acciones reales + sync.
                store.sendNovaMessage(transcript)
            }
        }
        .sheet(isPresented: $showVoiceDictation) {
            VoiceDictationSheet { transcript in
                // Dictado del input del chat: el texto NO se envía solo,
                // se carga en el draft para que el usuario lo revise y
                // confirme con el botón enviar.
                draft = transcript
                inputFocused = true
            }
            .presentationDetents([.height(380)])
            .presentationDragIndicator(.visible)
            .presentationBackground(Theme.Colors.background)
        }
        .onChange(of: nav.pendingNovaPrompt) { _, newPrompt in
            // Si Mi Día (u otra pantalla) llega con un texto pendiente, lo
            // disparamos al chat y limpiamos.
            guard let prompt = newPrompt,
                  !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else { return }
            store.sendNovaMessage(prompt)
            nav.pendingNovaPrompt = nil
        }
        .onAppear {
            // Drenar prompt pendiente en el primer appear también (no siempre se
            // dispara onChange si el valor ya estaba seteado).
            if let prompt = nav.pendingNovaPrompt,
               !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                store.sendNovaMessage(prompt)
                nav.pendingNovaPrompt = nil
            }
        }
    }

    // MARK: - Quick action dispatch

    /// Routea cada quick action a su efecto real: sheets, segmentos, mensajes
    /// + sugerencias en bandeja. Nada decorativo.
    private func handleQuickAction(_ action: NovaQuickAction) {
        HapticManager.shared.tap()
        switch action {
        case .crearTarea:
            showCreateTask = true

        case .crearEvento:
            showCreateEvent = true

        case .importarCalendario:
            showImportCalendar = true

        case .exportarCalendario:
            showExportCalendar = true

        case .revisarPendientes:
            withAnimation(.easeInOut(duration: 0.20)) {
                nav.novaSegment = .bandeja
            }

        case .organizar:
            // Disparamos al chat con "organiza mi día" — el parser local
            // hace el análisis REAL (eventos hoy, tareas, huecos, back-to-
            // back) y solo crea sugerencia si hay algo accionable. NO
            // metemos suggestion hardcoded — esta función ya no inventa
            // un "Plan del día actualizado" cuando no hay nada que
            // organizar.
            store.runQuickAction(.organizar)
            toast.show(.info("Analizando tu día", symbol: "sparkles"))
            withAnimation(.easeInOut(duration: 0.20)) {
                nav.novaSegment = .chat
            }

        case .prepararManana:
            store.runQuickAction(.prepararManana)
            let cal = Calendar.current
            let tomorrow = cal.date(byAdding: .day, value: 1, to: Date()) ?? Date()
            let tomorrowStart = cal.date(bySettingHour: 10, minute: 0, second: 0, of: tomorrow)
                ?? tomorrow
            let tomorrowEnd = cal.date(byAdding: .hour, value: 2, to: tomorrowStart) ?? tomorrowStart
            store.addSuggestion(NovaSuggestion(
                title: "Bloque para mañana",
                detail: "Te dejo 2 horas de foco antes de tu próxima reunión. Aprueba para agendarlo.",
                kind: .schedule,
                priority: .normal,
                suggestedAction: "Foco \(DateFormatters.hourMinute.string(from: tomorrowStart))–\(DateFormatters.hourMinute.string(from: tomorrowEnd))"
            ))
            toast.show(.info("Sugerencia para mañana", symbol: "moon.stars"))
            withAnimation(.easeInOut(duration: 0.20)) {
                nav.novaSegment = .bandeja
            }

        case .cerrarDia:
            store.runQuickAction(.cerrarDia)
            // Saltar al chat — el resumen es conversacional, no una decisión
            // que vaya a la bandeja.
            withAnimation(.easeInOut(duration: 0.20)) {
                nav.novaSegment = .chat
            }
        }
    }

    // MARK: - Branding header (consistente con Mi Día)

    private var branding: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center) {
                FocusBrandRow()
                Spacer()
                // Sparkle decorativo a la derecha — la primera señal de
                // que Nova es una capa especial, no otra sección más.
                ZStack {
                    Circle()
                        .fill(Theme.Colors.novaGradient)
                        .frame(width: 28, height: 28)
                        .shadow(color: Theme.Colors.novaAccent.opacity(0.50), radius: 12, y: 4)
                    NovaSparkMark(size: 12)
                }
            }
            // Theme 2.0: "Nova" en displayHero 34pt SemiBold + tracking
            // displayHero (-1.36) — coherente con "Mi Día" del bloque D.
            // El gradient horizontal cobalto→violet permanece como
            // diferenciador visual de Nova respecto al resto de pantallas
            // (que tienen títulos negros planos).
            Text("Nova")
                .font(Theme.Typography.displayHero)
                .tracking(Theme.Tracking.displayHero)
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Theme.Colors.focusAccent,
                            Theme.Colors.novaAccent
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
        }
    }

    // MARK: - Segmented control

    private var segmentedControl: some View {
        HStack(spacing: 0) {
            segmentButton(.bandeja, label: "Bandeja", badge: store.pendingDisplaySuggestions.count)
            segmentButton(.acciones, label: "Acciones")
            segmentButton(.chat, label: "Chat")
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(Theme.Colors.surfaceHigh)
        )
    }

    private func segmentButton(_ seg: NovaSegment, label: String, badge: Int = 0) -> some View {
        let isSelected = nav.novaSegment == seg
        return Button {
            HapticManager.shared.tick()
            withAnimation(.easeInOut(duration: 0.20)) {
                nav.novaSegment = seg
            }
        } label: {
            HStack(spacing: 6) {
                Text(label)
                    .font(Theme.Typography.subheadEmphasized)
                if badge > 0 {
                    Text("\(badge)")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Theme.Colors.novaAccent))
                }
            }
            .foregroundStyle(isSelected ? Theme.Colors.textPrimary : Theme.Colors.textTertiary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                    .fill(isSelected ? Theme.Colors.surface : Color.clear)
                    .focusCardShadow()
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Bandeja

    private var bandejaContent: some View {
        // El contenido se conecta directo al store + toast; no necesita
        // closure de callback ni inyección manual.
        NovaInboxContent()
    }

    // MARK: - Acciones

    private var accionesContent: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                accionesHeader
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.sm)

                LazyVGrid(
                    columns: [
                        GridItem(.flexible(), spacing: Theme.Spacing.md),
                        GridItem(.flexible(), spacing: Theme.Spacing.md)
                    ],
                    spacing: Theme.Spacing.md
                ) {
                    ForEach(NovaQuickAction.allCases) { action in
                        NovaActionCard(action: action) {
                            handleQuickAction(action)
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)

                tasksLink
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.sm)

                Spacer(minLength: Theme.Spacing.bottomBarSafety)
            }
        }
    }

    private var accionesHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("¿Qué quieres hacer?")
                .font(Theme.Typography.title1)
                .tracking(Theme.Tracking.title1)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("Toca una acción y Nova arranca contigo. Las decisiones quedan en Bandeja.")
                .font(Theme.Typography.subhead)
                .tracking(Theme.Tracking.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    /// Link a "Todas las tareas" — la única forma de llegar a la vista completa
    /// ahora que Tareas no es tab principal.
    private var tasksLink: some View {
        NavigationLink {
            TareasView()
        } label: {
            HStack(spacing: Theme.Spacing.md) {
                IconBadge(symbol: "checklist", tint: Theme.Colors.focusAccent, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Todas las tareas")
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("Lista completa con filtros y subtareas.")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
            .padding(Theme.Spacing.md)
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

    // MARK: - Chat

    /// Layout estilo iMessage cuando hay conversación, y estilo Gemini
    /// cuando está vacío: hero centrado con NovaSparkMark + "¿Qué quieres
    /// ordenar?" + chips de acciones rápidas. El input vive en `safeAreaInset`
    /// para anclarse arriba del teclado.
    private var chatContent: some View {
        Group {
            if store.novaMessages.isEmpty && !store.isNovaTyping {
                emptyChatHero
            } else {
                chatScroll
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            inputBar
        }
        // `.immediately` da comportamiento predecible — un scroll cierra
        // el teclado inmediatamente. `.interactively` causaba layouts
        // inestables donde el inputBar se sentía "pegado" al teclado a
        // medio bajar y desaparecía visualmente detrás de los chips.
        .scrollDismissesKeyboard(.immediately)
        // El `simultaneousGesture(TapGesture)` previo capturaba taps que
        // CAÍAN sobre el TextField del inputBar — el flujo era: tap →
        // dismiss keyboard → TextField gain focus → re-open keyboard,
        // dejando UI inestable. Lo quitamos: el usuario cierra teclado
        // con el botón "Listo" del toolbar o haciendo scroll.
    }

    /// Theme 2.0: empty hero opinado. Antes "34pt light" se sentía amable
    /// pero genérico (Apple Intelligence-like). Ahora displayHero 34pt
    /// SemiBold con tracking -1.36 — peso visual definido sin perder
    /// elegancia, alineado con Mi Día y Nova title.
    private var emptyChatHero: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: Theme.Spacing.lg) {
                Spacer(minLength: Theme.Spacing.xxxl + Theme.Spacing.md)
                ZStack {
                    // NovaPrism gradient (Theme 2.0) — stops opinados para
                    // IA, distintos del legacy novaGradient.
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .fill(Theme.Colors.novaPrismGradient)
                        .frame(width: 96, height: 96)
                        .overlay(
                            // Inner highlight specular — sensación 3D
                            // coherente con NovaVoiceCore de E.
                            RoundedRectangle(cornerRadius: 26, style: .continuous)
                                .stroke(Color.white.opacity(0.22), lineWidth: 0.8)
                        )
                        .shadow(color: Theme.Colors.novaAccent.opacity(0.55), radius: 28, y: 10)
                        .shadow(color: Theme.Colors.focusAccent.opacity(0.25), radius: 16, y: 4)
                    NovaSparkMark(size: 42)
                }
                .padding(.bottom, Theme.Spacing.sm)

                Text("¿Qué quieres ordenar?")
                    .font(Theme.Typography.displayHero)
                    .tracking(Theme.Tracking.displayHero)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.center)

                Text("Pídele a Nova un evento, una tarea, o que organice tu día.")
                    .font(Theme.Typography.body)
                    .tracking(Theme.Tracking.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .frame(maxWidth: 320)
                    .padding(.bottom, Theme.Spacing.lg)

                VStack(spacing: Theme.Spacing.sm + 2) {
                    if Self.isNovaLiveEnabled {
                        novaLiveChip
                    }
                    emptyStateChip(.organizar, symbol: "sparkles", label: "Organizar mi día")
                    emptyStateChip(.crearTarea, symbol: "checkmark.circle", label: "Crear tarea")
                    emptyStateChip(.crearEvento, symbol: "calendar.badge.plus", label: "Agendar evento")
                    emptyStateChip(.revisarPendientes, symbol: "tray.full", label: "Revisar pendientes")
                }
                .padding(.horizontal, Theme.Spacing.xl)

                Spacer(minLength: Theme.Spacing.xl)
            }
            .frame(maxWidth: .infinity)
        }
    }

    /// Chip destacado del empty state que abre Nova Live (sheet de voz).
    /// Estilo distintivo: gradient violeta sólido para que sobresalga
    /// del resto de chips (que son neutrales).
    private var novaLiveChip: some View {
        Button {
            HapticManager.shared.tap()
            showNovaLive = true
        } label: {
            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "mic.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Text("Hablar con Nova")
                    .font(Theme.Typography.bodyBold)
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "waveform")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
            }
            .padding(.horizontal, Theme.Spacing.md + 2)
            .padding(.vertical, Theme.Spacing.md)
            .frame(maxWidth: .infinity)
            .background(
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [Theme.Colors.focusAccent, Theme.Colors.novaAccent],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .shadow(color: Theme.Colors.novaAccent.opacity(0.35), radius: 14, y: 5)
            )
        }
        .buttonStyle(.plain)
    }

    private func emptyStateChip(_ action: NovaQuickAction, symbol: String, label: String) -> some View {
        Button {
            handleQuickAction(action)
        } label: {
            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Colors.novaAccent)
                Text(label)
                    .font(Theme.Typography.bodyEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
            .padding(.horizontal, Theme.Spacing.md + 2)
            .padding(.vertical, Theme.Spacing.md)
            .frame(maxWidth: .infinity)
            .background(
                Capsule()
                    .fill(Theme.Colors.surface)
                    .overlay(
                        Capsule()
                            .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
                    .focusCardShadow()
            )
        }
        .buttonStyle(.plain)
    }

    private var chatScroll: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: Theme.Spacing.md) {
                    ForEach(store.novaMessages) { msg in
                        NovaMessageBubble(message: msg).id(msg.id)
                    }
                    if store.isNovaTyping {
                        NovaTypingIndicator()
                            .id(Self.typingAnchor)
                            .transition(.opacity)
                    }
                    // Anchor invisible al final — permite hacer scroll a "abajo
                    // de todo" sin depender del último id (que puede cambiar
                    // entre renders).
                    Color.clear
                        .frame(height: 1)
                        .id(Self.chatBottomAnchor)
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.md)
                .padding(.bottom, Theme.Spacing.md)
            }
            .onChange(of: store.novaMessages.count) { _, _ in
                scrollToBottom(proxy: proxy, animated: true)
            }
            .onChange(of: store.isNovaTyping) { _, typing in
                if typing { scrollToBottom(proxy: proxy, animated: true) }
            }
            .onChange(of: inputFocused) { _, focused in
                if focused {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        scrollToBottom(proxy: proxy, animated: true)
                    }
                }
            }
            .onAppear {
                scrollToBottom(proxy: proxy, animated: false)
            }
        }
    }

    private static let chatBottomAnchor = "nova-chat-bottom"
    private static let typingAnchor = "nova-typing"

    private func scrollToBottom(proxy: ScrollViewProxy, animated: Bool) {
        if animated {
            withAnimation(.easeOut(duration: 0.25)) {
                proxy.scrollTo(Self.chatBottomAnchor, anchor: .bottom)
            }
        } else {
            proxy.scrollTo(Self.chatBottomAnchor, anchor: .bottom)
        }
    }

    /// Input multilínea para el chat. Vive dentro de `safeAreaInset(edge: .bottom)`
    /// del scroll, por lo que iOS lo posiciona automáticamente arriba del teclado.
    /// Crece hasta 4 líneas y después hace scroll interno.
    private var inputBar: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: Theme.Stroke.hairline)
                .opacity(0.5)

            HStack(alignment: .bottom, spacing: Theme.Spacing.sm) {
                TextField("Escríbele a Nova…", text: $draft, axis: .vertical)
                    .focused($inputFocused)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .tint(Theme.Colors.focusAccent)
                    .lineLimit(1...4)
                    .submitLabel(.send)
                    .onSubmit(submitDraft)
                    .padding(.vertical, 4)
                    // Toolbar "Listo" arriba del teclado — sin esto el
                    // usuario no tiene cómo cerrarlo si decide no enviar.
                    .toolbar {
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button("Listo") {
                                inputFocused = false
                            }
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Colors.focusAccent)
                        }
                    }

                // Mic del input del chat = dictado rápido para escribir
                // un mensaje. NO abre Nova Live — eso está en el chip
                // "Hablar con Nova" del empty state. Aquí el texto va al
                // draft, el usuario revisa y manda con el botón enviar.
                Button {
                    HapticManager.shared.tap()
                    showVoiceDictation = true
                } label: {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Colors.focusAccent)
                        .frame(width: 28, height: 28)
                        .background(
                            Circle().fill(Theme.Colors.focusAccentSoft)
                        )
                }
                .buttonStyle(.plain)

                Button(action: submitDraft) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(
                            Circle().fill(
                                draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? Theme.Colors.focusAccent.opacity(0.35)
                                    : Theme.Colors.focusAccent
                            )
                        )
                }
                .buttonStyle(.plain)
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, Theme.Spacing.md + 2)
            .padding(.vertical, Theme.Spacing.sm + 1)
            // Theme 2.0 fix v3: coherente con FocusBar Mi Día. Surface
            // sólida, borde soft hairline idle, borde NovaPrism + glow
            // sólo cuando focused. Sin tinte violet interno.
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                    .fill(Theme.Colors.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                    .strokeBorder(
                        inputFocused
                            ? AnyShapeStyle(Theme.Colors.novaPrismGradient)
                            : AnyShapeStyle(Theme.Colors.borderSoft),
                        lineWidth: inputFocused ? 1.5 : 1.0
                    )
            )
            .shadow(
                color: inputFocused
                    ? Theme.Colors.novaAccent.opacity(0.28)
                    : Color(red: 0.06, green: 0.07, blue: 0.10).opacity(0.08),
                radius: inputFocused ? 18 : 10,
                x: 0,
                y: inputFocused ? 7 : 4
            )
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.top, Theme.Spacing.sm + 2)
            .padding(.bottom, Theme.Spacing.sm)
            .animation(Theme.Motion.easeInOutStandard, value: inputFocused)
        }
        // Background SÓLIDO + sombra superior sutil para separar
        // visualmente del contenido scrollable. Sin `ignoresSafeArea` —
        // SwiftUI maneja la keyboard avoidance vía `safeAreaInset`.
        .background(
            Theme.Colors.background
                .shadow(color: .black.opacity(0.06), radius: 4, y: -2)
        )
    }

    private func submitDraft() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        store.sendNovaMessage(text)
    }
}

// MARK: - Action card (Acciones segment)

private struct NovaActionCard: View {
    let action: NovaQuickAction
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                IconBadge(symbol: action.symbol, tint: Theme.Colors.novaAccent, size: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(action.label)
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .multilineTextAlignment(.leading)
                    Text(action.subtitle)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                }
                Spacer(minLength: 0)
            }
            .padding(Theme.Spacing.md)
            .frame(maxWidth: .infinity, minHeight: 130, alignment: .topLeading)
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

// MARK: - Chat message (estilo Gemini: respuesta de Nova fluye como texto,
//                       sin burbuja; usuario sí mantiene burbuja sólida)

private struct NovaMessageBubble: View {
    let message: NovaMessage

    var body: some View {
        if message.role == .user {
            userRow
        } else {
            novaRow
        }
    }

    /// Mensaje del usuario: burbuja sólida cobalto alineada a la derecha.
    /// Sin gradient, sin shadow excesivo — limpio.
    private var userRow: some View {
        HStack(alignment: .top, spacing: 0) {
            Spacer(minLength: Theme.Spacing.xxl + Theme.Spacing.md)
            Text(message.content)
                .font(Theme.Typography.subhead)
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .padding(.horizontal, Theme.Spacing.md + 2)
                .padding(.vertical, Theme.Spacing.sm + 3)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(Theme.Colors.focusAccent)
                )
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Respuesta de Nova: fluye como texto regular con el spark mark
    /// al costado izquierdo. SIN burbuja, SIN border, SIN shadow.
    /// Igual que Gemini: el assistant "habla", no "manda mensajes".
    private var novaRow: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            novaSparkAvatar
            VStack(alignment: .leading, spacing: 6) {
                // Theme 2.0: label "NOVA" en captionMono — coherente con
                // badges del timeline (PRÓXIMO, EN CURSO).
                Text("Nova")
                    .font(Theme.Typography.captionMono)
                    .tracking(Theme.Tracking.captionMono)
                    .foregroundStyle(Theme.Colors.novaAccent)
                    .textCase(.uppercase)
                Text(message.content)
                    .font(Theme.Typography.body)
                    .tracking(Theme.Tracking.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Theme.Spacing.md)
        }
    }

    /// Avatar mini de Nova: cuadrado redondeado con NovaPrism gradient.
    /// Theme 2.0: cambio de novaGradient legacy → novaPrismGradient.
    private var novaSparkAvatar: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Theme.Colors.novaPrismGradient)
                .frame(width: 26, height: 26)
            NovaSparkMark(size: 11)
        }
        .padding(.top, 2)
    }
}

// MARK: - Typing indicator (3 puntos animados)

/// Indicador "Nova está escribiendo": 3 puntos que pulsan en secuencia.
/// Aparece debajo del último mensaje del usuario mientras `isNovaTyping == true`.
private struct NovaTypingIndicator: View {
    @State private var animating: Bool = false

    var body: some View {
        // Mismo layout que `novaRow` de NovaMessageBubble: avatar + dots
        // alineados, sin burbuja con border. Mantiene la coherencia con
        // las respuestas reales de Nova en el chat.
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Theme.Colors.novaGradient)
                    .frame(width: 26, height: 26)
                NovaSparkMark(size: 11)
            }
            .padding(.top, 2)

            HStack(spacing: 5) {
                ForEach(0..<3) { i in
                    Circle()
                        .fill(Theme.Colors.novaAccent.opacity(0.75))
                        .frame(width: 7, height: 7)
                        .scaleEffect(animating ? 1.0 : 0.45)
                        .opacity(animating ? 1.0 : 0.45)
                        .animation(
                            .easeInOut(duration: 0.65)
                                .repeatForever(autoreverses: true)
                                .delay(0.18 * Double(i)),
                            value: animating
                        )
                }
            }
            .padding(.top, 8)

            Spacer(minLength: Theme.Spacing.md)
        }
        .onAppear { animating = true }
    }
}
