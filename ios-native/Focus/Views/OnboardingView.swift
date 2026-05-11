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

    private let totalPages = 3

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            // Hero gradient sutil cobalt al top — identidad consistente con
            // BootView/Login (todo el "entry flow" comparte tinte azul).
            VStack(spacing: 0) {
                LinearGradient(
                    colors: [
                        Theme.Colors.focusAccent.opacity(0.12),
                        Theme.Colors.background
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 420)
                Spacer()
            }
            .ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.md)

                TabView(selection: $pageIndex) {
                    pageOne.tag(0)
                    pageTwo.tag(1)
                    pageThree.tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .indexViewStyle(.page(backgroundDisplayMode: .never))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(.easeInOut(duration: 0.2), value: pageIndex)

                actions
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.bottom, Theme.Spacing.xxl)
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
                Text("Planifica tu día con Nova como copiloto.")
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
                Text("Tu día, entendido")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text("Focus ordena eventos, tareas y bloques para que sepas qué hacer ahora.")
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
            timelineRow(time: "09:30", title: "Foco profundo", color: Theme.Colors.sectionFoco)
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
                Text("Nova decide contigo")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text("Revisa sugerencias, mueve tareas y prepara tu día sin empezar desde cero.")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.xl)
    }

    private var novaMock: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack(spacing: Theme.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(Theme.Colors.novaGradient)
                        .frame(width: 32, height: 32)
                    Image(systemName: "sparkle")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nova tiene 4 sugerencias")
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("Hace 2 min")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                }
                Spacer()
            }

            VStack(spacing: 8) {
                novaSuggestionRow(icon: "arrow.left.arrow.right", title: "Mover gym a mañana")
                novaSuggestionRow(icon: "tray.full", title: "Asignar bloque a 2 tareas")
                novaSuggestionRow(icon: "cup.and.saucer", title: "Reservar pausa después de Acme")
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
