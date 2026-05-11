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

    @State private var draft: String = ""
    @State private var showCreateTask: Bool = false
    @State private var showCreateEvent: Bool = false
    @State private var showImportCalendar: Bool = false
    @State private var showExportCalendar: Bool = false
    @FocusState private var inputFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    branding
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.top, Theme.Spacing.md)

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
            store.runQuickAction(.organizar)
            store.addSuggestion(NovaSuggestion(
                title: "Plan del día actualizado",
                detail: "Bloqueé tu mañana para foco profundo y dejé una pausa real al mediodía. Confirma si quieres aplicarlo.",
                kind: .rebalance,
                priority: .high,
                suggestedAction: "Aplicar plan del día"
            ))
            toast.show(.info("Plan generado", symbol: "sparkles"))
            withAnimation(.easeInOut(duration: 0.20)) {
                nav.novaSegment = .bandeja
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
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center) {
                FocusBrandRow()
                Spacer()
            }
            Text("Nova")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
        }
    }

    // MARK: - Segmented control

    private var segmentedControl: some View {
        HStack(spacing: 0) {
            segmentButton(.bandeja, label: "Bandeja", badge: store.pendingSuggestions.count)
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
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("Toca una acción y Nova arranca contigo. Las decisiones quedan en Bandeja.")
                .font(Theme.Typography.subhead)
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

    private var chatContent: some View {
        VStack(spacing: 0) {
            chatScroll
            inputBar
        }
    }

    private var chatScroll: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: Theme.Spacing.sm) {
                    ForEach(store.novaMessages) { msg in
                        NovaMessageBubble(message: msg).id(msg.id)
                    }
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.sm)
                .padding(.bottom, Theme.Spacing.sm)
            }
            .onChange(of: store.novaMessages.count) { _, _ in
                if let last = store.novaMessages.last {
                    withAnimation(.easeOut(duration: 0.25)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    /// Input compacto en la conversación — sin sparkle ni mic, ya estás dentro
    /// de Nova. Reduce el feel "chat genérico".
    private var inputBar: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: Theme.Stroke.hairline)
                .opacity(0.5)

            HStack(spacing: Theme.Spacing.sm) {
                TextField("Escríbele a Nova…", text: $draft, axis: .horizontal)
                    .focused($inputFocused)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .tint(Theme.Colors.focusAccent)
                    .submitLabel(.send)
                    .onSubmit(submitDraft)

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
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.xxl, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.xxl, style: .continuous)
                            .strokeBorder(
                                inputFocused ? Theme.Colors.focusAccent.opacity(0.4) : Theme.Colors.border,
                                lineWidth: inputFocused ? 1.2 : Theme.Stroke.hairline
                            )
                    )
            )
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.top, Theme.Spacing.sm + 2)
            .padding(.bottom, Theme.Spacing.sm)
            .animation(.easeInOut(duration: 0.18), value: inputFocused)
        }
        .background(Theme.Colors.background)
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

// MARK: - Chat bubble

private struct NovaMessageBubble: View {
    let message: NovaMessage

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.sm) {
            if message.role == .user {
                Spacer(minLength: Theme.Spacing.xxl)
            } else {
                Circle()
                    .fill(Theme.Colors.novaGradient)
                    .frame(width: 8, height: 8)
                    .padding(.top, 9)
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 2) {
                Text(message.content)
                    .font(Theme.Typography.subhead)
                    .foregroundStyle(message.role == .user ? .white : Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.vertical, Theme.Spacing.sm + 1)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .fill(
                                message.role == .user
                                    ? AnyShapeStyle(Theme.Colors.focusAccent)
                                    : AnyShapeStyle(Theme.Colors.surface)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                                    .strokeBorder(
                                        message.role == .user ? Color.clear : Theme.Colors.border,
                                        lineWidth: Theme.Stroke.hairline
                                    )
                            )
                    )
                    .fixedSize(horizontal: false, vertical: true)
                Text(timestampLabel)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textQuaternary)
            }

            if message.role == .nova {
                Spacer(minLength: Theme.Spacing.xxl)
            }
        }
    }

    private var timestampLabel: String {
        DateFormatters.hourMinute.string(from: message.timestamp)
    }
}
