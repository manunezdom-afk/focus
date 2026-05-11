import SwiftUI

struct NovaView: View {
    @EnvironmentObject private var store: FocusDataStore
    @State private var draft: String = ""
    @State private var showInbox = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    header
                    chatScroll
                    inputBar
                }
            }
            .navigationDestination(isPresented: $showInbox) {
                NovaInboxView()
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: Theme.Spacing.md) {
                IconBadge(symbol: "sparkles", tint: Theme.Colors.novaAccent, size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nova")
                        .font(Theme.Typography.title)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("Tu centro inteligente para organizar el día.")
                        .font(Theme.Typography.subhead)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                Spacer()
                inboxButton
            }
            .padding(.horizontal, Theme.Spacing.xl)
            .padding(.top, Theme.Spacing.lg)
            .padding(.bottom, Theme.Spacing.md)

            if store.pendingSuggestions.count > 0 {
                Button {
                    HapticManager.shared.tap()
                    showInbox = true
                } label: {
                    HStack(spacing: Theme.Spacing.sm) {
                        Image(systemName: "tray.full")
                            .font(.system(size: 12, weight: .semibold))
                        Text("\(store.pendingSuggestions.count) sugerencias en tu Bandeja")
                            .font(Theme.Typography.subheadEmphasized)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(Theme.Colors.novaAccent)
                    .padding(.horizontal, Theme.Spacing.md + 2)
                    .padding(.vertical, Theme.Spacing.sm + 2)
                    .background(
                        Capsule()
                            .fill(Theme.Colors.novaAccentSoft)
                            .overlay(
                                Capsule()
                                    .strokeBorder(Theme.Colors.novaAccent.opacity(0.35), lineWidth: Theme.Stroke.hairline)
                            )
                    )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, Theme.Spacing.xl)
                .padding(.bottom, Theme.Spacing.md)
            }

            quickActionsRow
                .padding(.bottom, Theme.Spacing.md)

            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: Theme.Stroke.hairline)
                .opacity(0.6)
        }
        .background(Theme.Colors.background)
    }

    private var inboxButton: some View {
        Button {
            HapticManager.shared.tap()
            showInbox = true
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "tray.full")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .frame(width: 38, height: 38)
                    .background(
                        Circle()
                            .fill(Theme.Colors.surfaceElevated)
                            .overlay(
                                Circle()
                                    .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                            )
                    )
                if store.pendingSuggestions.count > 0 {
                    Circle()
                        .fill(Theme.Colors.novaAccent)
                        .frame(width: 9, height: 9)
                        .overlay(Circle().strokeBorder(Theme.Colors.background, lineWidth: 1.5))
                        .offset(x: 2, y: -2)
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Quick actions

    private var quickActionsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(NovaQuickAction.allCases) { action in
                    Button {
                        store.runQuickAction(action)
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: action.symbol)
                                .font(.system(size: 12, weight: .semibold))
                            Text(action.label)
                                .font(Theme.Typography.subheadEmphasized)
                        }
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .padding(.horizontal, Theme.Spacing.md + 2)
                        .padding(.vertical, Theme.Spacing.sm + 1)
                        .background(
                            Capsule()
                                .fill(Theme.Colors.surface)
                                .overlay(
                                    Capsule()
                                        .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Theme.Spacing.xl)
        }
    }

    // MARK: - Chat

    private var chatScroll: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: Theme.Spacing.md) {
                    ForEach(store.novaMessages) { msg in
                        NovaMessageBubble(message: msg)
                            .id(msg.id)
                    }
                }
                .padding(.horizontal, Theme.Spacing.xl)
                .padding(.top, Theme.Spacing.lg)
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

    // MARK: - Input bar

    private var inputBar: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: Theme.Stroke.hairline)
                .opacity(0.5)

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
                IconBadge(symbol: "sparkles", tint: Theme.Colors.novaAccent, size: 28)
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, Theme.Spacing.md + 2)
                    .padding(.vertical, Theme.Spacing.md - 1)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                            .fill(message.role == .user ? Theme.Colors.novaAccentSoft : Theme.Colors.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                                    .strokeBorder(
                                        message.role == .user ? Theme.Colors.novaAccent.opacity(0.30) : Theme.Colors.border,
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

#Preview {
    NovaView()
        .environmentObject(FocusDataStore())
        .preferredColorScheme(.dark)
}
