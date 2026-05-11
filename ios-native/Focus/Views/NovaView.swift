import SwiftUI

/// Nova como sheet (no es tab). Se abre desde el FocusBar de Mi Día.
/// Tiene dos segmentos: Conversación y Bandeja.
struct NovaView: View {
    enum Segment: Hashable { case chat, bandeja }

    @EnvironmentObject private var store: FocusDataStore
    @Environment(\.dismiss) private var dismiss
    @State private var segment: Segment = .chat
    @State private var draft: String = ""
    @State private var didAutoSubmit: Bool = false
    @FocusState private var inputFocused: Bool

    let initialPrompt: String?

    init(initialPrompt: String? = nil) {
        self.initialPrompt = initialPrompt
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    segmentedControl
                        .padding(.horizontal, Theme.Spacing.xl)
                        .padding(.top, Theme.Spacing.sm)
                        .padding(.bottom, Theme.Spacing.md)
                        .background(Theme.Colors.background)

                    Group {
                        if segment == .chat {
                            chatContent
                        } else {
                            NovaInboxContent(
                                onUpdate: { id, status in
                                    store.updateSuggestion(id, status: status)
                                }
                            )
                        }
                    }
                }
            }
            .navigationTitle("Nova")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.light, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HStack(spacing: 6) {
                        // Identidad mínima: solo el punto Nova, sin pulse animado.
                        Circle()
                            .fill(Theme.Colors.novaGradient)
                            .frame(width: 10, height: 10)
                        Text("Nova")
                            .font(Theme.Typography.bodyBold)
                            .foregroundStyle(Theme.Colors.textPrimary)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Text("Cerrar")
                            .font(Theme.Typography.bodyEmphasized)
                            .foregroundStyle(Theme.Colors.focusAccent)
                    }
                }
            }
        }
        .onAppear {
            // Auto-submit del prompt inicial si llegó desde Mi Día.
            guard !didAutoSubmit,
                  let prompt = initialPrompt,
                  !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else { return }
            didAutoSubmit = true
            store.sendNovaMessage(prompt)
        }
    }

    // MARK: - Segmented

    private var segmentedControl: some View {
        HStack(spacing: 0) {
            segmentButton(.chat, label: "Conversación", symbol: "bubble.left.fill")
            segmentButton(.bandeja, label: "Bandeja", symbol: "tray.full.fill", badgeCount: store.pendingSuggestions.count)
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(Theme.Colors.surfaceHigh)
        )
    }

    private func segmentButton(_ seg: Segment, label: String, symbol: String, badgeCount: Int = 0) -> some View {
        Button {
            HapticManager.shared.tick()
            withAnimation(.easeInOut(duration: 0.18)) {
                segment = seg
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: symbol)
                    .font(.system(size: 11, weight: .semibold))
                Text(label)
                    .font(Theme.Typography.subheadEmphasized)
                if badgeCount > 0 {
                    Text("\(badgeCount)")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Theme.Colors.novaAccent))
                }
            }
            .foregroundStyle(segment == seg ? Theme.Colors.textPrimary : Theme.Colors.textTertiary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                    .fill(segment == seg ? Theme.Colors.surface : Color.clear)
                    .focusCardShadow()
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Chat content

    private var chatContent: some View {
        VStack(spacing: 0) {
            chatScroll
            quickActionsRow
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

    private var quickActionsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.xs + 2) {
                ForEach(NovaQuickAction.allCases) { action in
                    Button {
                        store.runQuickAction(action)
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: action.symbol)
                                .font(.system(size: 10, weight: .semibold))
                            Text(action.label)
                                .font(Theme.Typography.subheadEmphasized)
                        }
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .padding(.horizontal, Theme.Spacing.md)
                        .padding(.vertical, Theme.Spacing.xs + 2)
                        .background(
                            Capsule()
                                .fill(Theme.Colors.surface)
                                .overlay(
                                    Capsule().strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.vertical, Theme.Spacing.xs + 2)
        }
    }

    /// Input compacto, sin avatar Nova (ya estás en Nova) ni micrófono — solo
    /// el campo y el botón de enviar. Reduce el feel "chat genérico".
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

// MARK: - Chat bubble

private struct NovaMessageBubble: View {
    let message: NovaMessage

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.sm) {
            if message.role == .user {
                Spacer(minLength: Theme.Spacing.xxl)
            } else {
                // Marker minimalista — solo un punto, sin avatar circular.
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
