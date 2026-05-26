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
        let isChat = nav.novaSegment == .chat
        return HStack(spacing: 0) {
            segmentButton(.bandeja, label: "Bandeja", badge: store.pendingDisplaySuggestions.count)
            segmentButton(.acciones, label: "Acciones")
            segmentButton(.chat, label: "Chat")
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(isChat ? AnyShapeStyle(Theme.Colors.novaGlassFill) : AnyShapeStyle(Theme.Colors.surfaceHigh))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .strokeBorder(isChat ? Theme.Colors.novaGlassStroke : Color.clear, lineWidth: 0.8)
        )
        .animation(.easeInOut(duration: 0.22), value: nav.novaSegment)
    }

    private func segmentButton(_ seg: NovaSegment, label: String, badge: Int = 0) -> some View {
        let isSelected = nav.novaSegment == seg
        let isChat = nav.novaSegment == .chat
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
            .foregroundStyle(
                isSelected 
                    ? (isChat ? Theme.Colors.novaTextOnDark : Theme.Colors.textPrimary) 
                    : (isChat ? Theme.Colors.novaTextOnDarkSecondary.opacity(0.65) : Theme.Colors.textTertiary)
            )
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                    .fill(
                        isSelected 
                            ? (isChat ? AnyShapeStyle(Theme.Colors.novaGlassUserFill) : AnyShapeStyle(Theme.Colors.surface))
                            : AnyShapeStyle(Color.clear)
                    )
                    .focusCardShadow(strong: isChat)
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

    // MARK: - Chat (glassmorphic dark — rediseño 2026-05)
    //
    // El segmento Chat entra en "modo IA premium": fondo violet-black
    // glassmorphic, burbujas glass para usuario y Nova, markdown render
    // con code blocks + copy, input flotante con auto-expand y glow,
    // typing indicator hiper-minimalista. Bandeja y Acciones siguen
    // light, igual que Mi Día/Calendario. La transición visual entre
    // los segmentos refuerza la diferencia: el chat es donde la IA
    // habla, los otros segmentos son workflow productivo.

    private var chatContent: some View {
        ZStack {
            NovaChatBackdrop()

            Group {
                if store.novaMessages.isEmpty && !store.isNovaTyping {
                    NovaEmptyChatHeroDark(
                        onChip: { action in
                            handleQuickAction(action)
                        },
                        showLiveChip: Self.isNovaLiveEnabled,
                        onLive: Self.isNovaLiveEnabled
                            ? {
                                HapticManager.shared.tap()
                                showNovaLive = true
                            }
                            : nil
                    )
                } else {
                    chatScroll
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            inputBar
        }
        // `.immediately` da comportamiento predecible — un scroll cierra
        // el teclado inmediatamente.
        .scrollDismissesKeyboard(.immediately)
    }

    private var chatScroll: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: Theme.Spacing.lg) {
                    ForEach(store.novaMessages) { msg in
                        Group {
                            if msg.role == .user {
                                NovaGlassUserBubble(content: msg.content)
                            } else {
                                NovaGlassNovaBubble(content: msg.content)
                            }
                        }
                        .id(msg.id)
                        // Entrada suave: fade-in + slide-up sutil para cada
                        // nuevo mensaje. La salida es solo opacity para que
                        // los message id changes no muevan la altura.
                        .transition(.asymmetric(
                            insertion: .opacity.combined(with: .offset(y: 10)),
                            removal: .opacity
                        ))
                    }
                    if store.isNovaTyping {
                        NovaPulseTypingIndicator()
                            .id(Self.typingAnchor)
                            .transition(.opacity.combined(with: .offset(y: 8)))
                    }
                    // Anchor invisible al final — permite hacer scroll a
                    // "abajo de todo" sin depender del último id.
                    Color.clear
                        .frame(height: 1)
                        .id(Self.chatBottomAnchor)
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.lg)
                .padding(.bottom, Theme.Spacing.lg)
                .animation(Theme.Spring.entrance, value: store.novaMessages.count)
                .animation(Theme.Spring.entrance, value: store.isNovaTyping)
            }
            .onChange(of: store.novaMessages.count) { _, _ in
                scrollToBottom(proxy: proxy, animated: true)
            }
            .onChange(of: store.isNovaTyping) { _, typing in
                if typing { scrollToBottom(proxy: proxy, animated: true) }
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
            withAnimation(.easeOut(duration: 0.28)) {
                proxy.scrollTo(Self.chatBottomAnchor, anchor: .bottom)
            }
        } else {
            proxy.scrollTo(Self.chatBottomAnchor, anchor: .bottom)
        }
    }

    /// Input bar glass del chat. Reemplaza el FocusBarInput compartido —
    /// el chat es la única superficie dark de la app, así que tiene su
    /// propio input bar (NovaGlassInputBar) sin afectar Mi Día/Calendario
    /// que siguen usando FocusBarInput sobre fondo light.
    ///
    /// El gradient encima del input crea un fade del scroll content hacia
    /// la barra, evitando que un mensaje largo "termine cortado" pegado
    /// al borde superior del input.
    private var inputBar: some View {
        VStack(spacing: 0) {
            // Fade superior — gradient vertical transparent → fondo dark
            // para suavizar el corte entre scroll content y la barra.
            LinearGradient(
                colors: [
                    Color.clear,
                    Color(red: 0.04, green: 0.02, blue: 0.10).opacity(0.65)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 14)
            .allowsHitTesting(false)

            NovaGlassInputBar(
                text: $draft,
                placeholder: "Escríbele a Nova…",
                onSubmit: submitDraft,
                onMic: {
                    showVoiceDictation = true
                }
            )
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.top, 2)
            .padding(.bottom, Theme.Spacing.sm)
            .background(
                // Detrás del input: gradient + blur sutil para que el
                // backdrop dark se difumine bajo el bar sin verse plano.
                Color(red: 0.04, green: 0.02, blue: 0.10).opacity(0.70)
                    .background(.ultraThinMaterial.opacity(0.40))
                    .environment(\.colorScheme, .dark)
            )
        }
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

// Las bubbles del chat y el typing indicator viven ahora en
// `Shared/NovaChatComponents.swift` (NovaGlassUserBubble, NovaGlassNovaBubble,
// NovaPulseTypingIndicator). Aquí solo queda el shell del NovaView con
// branding + segment control + dispatch de quick actions.
