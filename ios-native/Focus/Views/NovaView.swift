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
                        .padding(.vertical, Theme.Spacing.md)
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
                        ZStack {
                            Circle()
                                .fill(Theme.Colors.novaGradient)
                                .frame(width: 22, height: 22)
                            Image(systemName: "sparkle")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.white)
                        }
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
            // Si llegamos con un prompt inicial, enviarlo automáticamente
            if let prompt = initialPrompt,
               !didAutoSubmit,
               !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                didAutoSubmit = true
                Task { @MainActor in
                    store.sendNovaMessage(prompt)
                }
            }
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
                VStack(spacing: Theme.Spacing.md) {
                    ForEach(store.novaMessages) { msg in
                        NovaMessageBubble(message: msg).id(msg.id)
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)
                .padding(.top, Theme.Spacing.md)
                .padding(.bottom, Theme.Spacing.md)
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
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(NovaQuickAction.allCases) { action in
                    Button {
                        store.runQuickAction(action)
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: action.symbol)
                                .font(.system(size: 11, weight: .semibold))
                            Text(action.label)
                                .font(Theme.Typography.subheadEmphasized)
                        }
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .padding(.horizontal, Theme.Spacing.md + 2)
                        .padding(.vertical, Theme.Spacing.sm)
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
            .padding(.horizontal, Theme.Spacing.xl)
            .padding(.vertical, Theme.Spacing.sm)
        }
    }

    private var inputBar: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: Theme.Stroke.hairline)
                .opacity(0.6)

            FocusBarInput(
                text: $draft,
                placeholder: "Escríbele a Nova…",
                onSubmit: {
                    let text = draft
                    draft = ""
                    store.sendNovaMessage(text)
                },
                onMic: { HapticManager.shared.tap() }
            )
            .padding(.horizontal, Theme.Spacing.xl)
            .padding(.top, Theme.Spacing.md)
            .padding(.bottom, Theme.Spacing.md)
        }
        .background(Theme.Colors.background)
    }
}

// MARK: - Chat bubble

private struct NovaMessageBubble: View {
    let message: NovaMessage

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            if message.role == .user {
                Spacer(minLength: Theme.Spacing.xxxl)
            } else {
                ZStack {
                    Circle()
                        .fill(Theme.Colors.novaGradient)
                        .frame(width: 28, height: 28)
                    Image(systemName: "sparkle")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                }
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(Theme.Typography.body)
                    .foregroundStyle(message.role == .user ? .white : Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, Theme.Spacing.md + 2)
                    .padding(.vertical, Theme.Spacing.md - 1)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                            .fill(
                                message.role == .user
                                    ? AnyShapeStyle(Theme.Colors.focusAccent)
                                    : AnyShapeStyle(Theme.Colors.surface)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                                    .strokeBorder(
                                        message.role == .user ? Color.clear : Theme.Colors.border,
                                        lineWidth: Theme.Stroke.hairline
                                    )
                            )
                            .focusCardShadow()
                    )
                    .fixedSize(horizontal: false, vertical: true)
                Text(timestampLabel)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textQuaternary)
            }

            if message.role == .nova {
                Spacer(minLength: Theme.Spacing.xxxl)
            }
        }
    }

    private var timestampLabel: String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "es_ES")
        fmt.dateFormat = "HH:mm"
        return fmt.string(from: message.timestamp)
    }
}
