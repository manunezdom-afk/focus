import SwiftUI

/// Onboarding 3 pantallas. Cada página tiene un visual propio (no sólo un icono):
/// 1. Marca Focus + propuesta de valor.
/// 2. Mock timeline (cómo se ve tu día en Focus).
/// 3. Mock Nova card (cómo Nova actúa).
///
/// Persistencia: `@AppStorage("focus.v1.hasSeenOnboarding")`.
/// Replay desde Ajustes → Acerca de → "Ver tutorial otra vez".
struct OnboardingView: View {
    @EnvironmentObject private var auth: AuthStore
    @AppStorage("focus.v1.hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var pageIndex: Int = 0
    /// Fade-in interno al aparecer — transición suave sin riesgo de
    /// overlay (la animación vive DENTRO de esta view, no en el root).
    @State private var contentVisible: Bool = false

    private let totalPages = 4

    var body: some View {
        ZStack {
            // Fondo: gradient cobalto multi-stop. Pintado SIEMPRE (sin
            // depender de contentVisible) para que el fade-in del contenido
            // se vea sobre el cobalto, no sobre blanco. Multi-stop con un
            // guiño violeta hacia el medio para profundidad visual y
            // continuidad con el diamante Nova del logo.
            LinearGradient(
                gradient: Gradient(stops: [
                    .init(color: Theme.Colors.focusAccent.opacity(0.28), location: 0.00),
                    .init(color: Theme.Colors.focusAccent.opacity(0.14), location: 0.35),
                    .init(color: Theme.Colors.novaAccent.opacity(0.06),  location: 0.70),
                    .init(color: Theme.Colors.background,                 location: 1.00),
                ]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.md)

                TabView(selection: $pageIndex) {
                    pageOne.tag(0)
                    pageTwo.tag(1)
                    pageThree.tag(2)
                    pageFour.tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .indexViewStyle(.page(backgroundDisplayMode: .never))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(.easeInOut(duration: 0.2), value: pageIndex)

                actions
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.bottom, Theme.Spacing.xxl)
            }
            .opacity(contentVisible ? 1 : 0)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.32)) {
                contentVisible = true
            }
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            FocusWordmark(fontSize: 12, color: Theme.Colors.textTertiary, tracking: 3)
            Spacer()
            Button("Saltar") { finishWithLogin() }
                .font(Theme.Typography.subheadEmphasized)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    // MARK: - Page 1: Brand + value prop

    private var pageOne: some View {
        VStack(spacing: Theme.Spacing.xxl) {
            Spacer(minLength: 0)

            FocusLogoMark(size: 132)
                .padding(.bottom, Theme.Spacing.md)

            VStack(spacing: Theme.Spacing.md) {
                Text("Focus OS")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text("Tu día, tus tareas y Nova en un solo lugar.")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }

            Spacer(minLength: 0)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.xl)
    }

    // MARK: - Page 2: Mock timeline (cómo se ve tu día)

    private var pageTwo: some View {
        VStack(spacing: Theme.Spacing.xxl) {
            Spacer(minLength: 0)

            timelineMock
                .padding(.horizontal, Theme.Spacing.xl)

            VStack(spacing: Theme.Spacing.md) {
                Text("Ordena tu día sin pensarlo tanto")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Ve tus bloques, pendientes y recordatorios en una vista simple.")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.xl)
    }

    private var timelineMock: some View {
        VStack(spacing: Theme.Spacing.sm) {
            timelineRow(time: "09:30", title: "Bloque de trabajo", color: Theme.Colors.sectionFoco)
            timelineRow(time: "11:15", title: "Reunión con Sofía", color: Theme.Colors.sectionReunion)
            timelineRow(time: "13:00", title: "Almuerzo", color: Theme.Colors.sectionPersonal)
            timelineRow(time: "15:00", title: "Estudiar Bases de Datos", color: Theme.Colors.sectionEstudio)
        }
        .padding(Theme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                )
                .focusCardShadow(strong: true)
        )
    }

    private func timelineRow(time: String, title: String, color: Color) -> some View {
        HStack(spacing: Theme.Spacing.md) {
            Text(time)
                .font(Theme.Typography.timestamp)
                .foregroundStyle(Theme.Colors.textSecondary)
                .frame(width: 48, alignment: .trailing)

            Rectangle()
                .fill(color)
                .frame(width: 3, height: 20)
                .clipShape(Capsule())

            Text(title)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .lineLimit(1)

            Spacer()
        }
    }

    // MARK: - Page 3: Mock Nova card (cómo Nova actúa)

    private var pageThree: some View {
        VStack(spacing: Theme.Spacing.xxl) {
            Spacer(minLength: 0)

            novaMock
                .padding(.horizontal, Theme.Spacing.xl)

            VStack(spacing: Theme.Spacing.md) {
                Text("Díselo como hablas")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Pídele a Nova: «mañana despiértame a las 7 y recuérdame salir a las 8».")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.xl)
    }

    // MARK: - Page 4: Recordatorios + calendario

    private var pageFour: some View {
        VStack(spacing: Theme.Spacing.xxl) {
            Spacer(minLength: 0)

            reminderMock
                .padding(.horizontal, Theme.Spacing.xl)

            VStack(spacing: Theme.Spacing.md) {
                Text("Que nada se te pase")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Focus guarda eventos, tareas y te avisa en el momento correcto.")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.xl)
    }

    /// Mock de notificación push estilo iOS — banner blanco con icono
    /// app + título + subtitle. Liviano: solo formas y texto, sin
    /// animación infinita ni blur.
    private var reminderMock: some View {
        VStack(spacing: Theme.Spacing.md) {
            HStack(spacing: Theme.Spacing.md) {
                // Icono "Focus" en miniatura — cobalto con sparkle blanco.
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.180, green: 0.310, blue: 0.910),
                                Color(red: 0.094, green: 0.184, blue: 0.510)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: 38, height: 38)
                    .overlay(
                        NovaSparkMark(size: 16)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text("Focus")
                            .font(Theme.Typography.bodyBold)
                            .foregroundStyle(Theme.Colors.textPrimary)
                        Spacer()
                        Text("ahora")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                    }
                    Text("Salir a buscar a tu hermano")
                        .font(Theme.Typography.subhead)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .lineLimit(1)
                    Text("En 5 min")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.focusAccent)
                }
            }
            .padding(Theme.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(Theme.Colors.focusAccent.opacity(0.22), lineWidth: 1)
                    )
                    .focusCardShadow(strong: true)
            )

            // Mini timeline preview — sugiere que el recordatorio queda
            // visible en el día, no solo como notif puntual.
            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "calendar")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Colors.focusAccent)
                Text("También aparece en tu día")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                Spacer()
            }
            .padding(.horizontal, Theme.Spacing.sm)
        }
    }

    private var novaMock: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(spacing: Theme.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(Theme.Colors.novaGradient)
                        .frame(width: 32, height: 32)
                    NovaSparkMark(size: 14)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nova entendió")
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("Hace un momento")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                }
                Spacer()
            }

            VStack(spacing: 8) {
                novaSuggestionRow(icon: "alarm", title: "Despertarte mañana 07:00")
                novaSuggestionRow(icon: "figure.walk", title: "Salir mañana 08:00")
                novaSuggestionRow(icon: "bell", title: "Aviso 10 min antes de cada uno")
            }
        }
        .padding(Theme.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .strokeBorder(Theme.Colors.novaAccent.opacity(0.30), lineWidth: Theme.Stroke.hairline)
                )
                .focusCardShadow(strong: true)
        )
    }

    private func novaSuggestionRow(icon: String, title: String) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Colors.novaAccent)
                .frame(width: 20, height: 20)
                .background(Circle().fill(Theme.Colors.novaAccentSoft))

            Text(title)
                .font(Theme.Typography.subhead)
                .foregroundStyle(Theme.Colors.textPrimary)
                .lineLimit(1)

            Spacer()
        }
    }

    // MARK: - Bottom actions

    @ViewBuilder
    private var actions: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Button {
                if pageIndex < totalPages - 1 {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        pageIndex += 1
                    }
                } else {
                    finishWithLogin()
                }
            } label: {
                Text(pageIndex < totalPages - 1 ? "Siguiente" : "Empezar")
                    .font(Theme.Typography.bodyBold)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.md + 4)
                    .background(
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Theme.Colors.focusAccent,
                                        Theme.Colors.focusAccentHover
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .shadow(color: Theme.Colors.focusAccent.opacity(0.40), radius: 16, x: 0, y: 6)
                    )
            }
            .buttonStyle(.plain)

            if pageIndex == totalPages - 1 {
                Button { finishWithDemo() } label: {
                    Text("Probar en modo demo")
                        .font(Theme.Typography.subheadEmphasized)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .padding(.vertical, Theme.Spacing.sm)
                }
                .buttonStyle(.plain)
                .transition(.opacity)
            }
        }
    }

    // MARK: - Finish

    private func finishWithLogin() {
        HapticManager.shared.tap()
        hasSeenOnboarding = true
    }

    private func finishWithDemo() {
        HapticManager.shared.tap()
        hasSeenOnboarding = true
        auth.enterDemo()
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AuthStore())
}
