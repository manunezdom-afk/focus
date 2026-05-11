import SwiftUI

/// Onboarding inicial de 3 pasos. Solo aparece la primera vez (controlado por
/// `@AppStorage("focus.v1.hasSeenOnboarding")` que se persiste en UserDefaults).
///
/// Desde Ajustes "Ver tutorial otra vez", se setea hasSeenOnboarding = false
/// y la app vuelve a mostrar este flow.
struct OnboardingView: View {
    @EnvironmentObject private var auth: AuthStore
    @AppStorage("focus.v1.hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var pageIndex: Int = 0

    private let totalPages = 3

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.md)

                TabView(selection: $pageIndex) {
                    OnboardingPage(
                        symbol: nil,
                        showBrandLogo: true,
                        title: "Bienvenido a Focus",
                        message: "Tu día, tus tareas y Nova en un solo lugar."
                    )
                    .tag(0)

                    OnboardingPage(
                        symbol: "calendar.day.timeline.left",
                        showBrandLogo: false,
                        title: "Organiza tu día",
                        message: "Planifica bloques, tareas y eventos sin perder claridad."
                    )
                    .tag(1)

                    OnboardingPage(
                        symbol: "sparkle",
                        symbolUsesNovaGradient: true,
                        showBrandLogo: false,
                        title: "Habla con Nova",
                        message: "Pídele que cree tareas, revise pendientes o te ayude a ordenar tu día."
                    )
                    .tag(2)
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

    // MARK: - Top bar (Saltar)

    private var topBar: some View {
        HStack {
            Spacer()
            Button("Saltar") {
                finishWithLogin()
            }
            .font(Theme.Typography.subheadEmphasized)
            .foregroundStyle(Theme.Colors.textSecondary)
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
                    .padding(.vertical, Theme.Spacing.md + 2)
                    .background(
                        Capsule()
                            .fill(Theme.Colors.focusAccent)
                            .shadow(color: Theme.Colors.focusAccent.opacity(0.30), radius: 12, x: 0, y: 4)
                    )
            }
            .buttonStyle(.plain)

            if pageIndex == totalPages - 1 {
                Button {
                    finishWithDemo()
                } label: {
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

    // MARK: - Finish actions

    private func finishWithLogin() {
        HapticManager.shared.tap()
        hasSeenOnboarding = true
        // ContentView reroutea → LoginView (porque auth.state == .loggedOut)
    }

    private func finishWithDemo() {
        HapticManager.shared.tap()
        hasSeenOnboarding = true
        auth.enterDemo()
        // ContentView reroutea → MainTabView (auth.state == .demo)
    }
}

// MARK: - Single onboarding page

private struct OnboardingPage: View {
    let symbol: String?
    var symbolUsesNovaGradient: Bool = false
    let showBrandLogo: Bool
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: Theme.Spacing.xxl) {
            Spacer(minLength: 0)
            hero
            VStack(spacing: Theme.Spacing.sm) {
                Text(title)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }
            .padding(.horizontal, Theme.Spacing.xl)
            Spacer(minLength: 0)
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var hero: some View {
        if showBrandLogo {
            // FocusLogoMark — mismo brand mark que el AppIcon y BootView.
            FocusLogoMark(size: 120)
                .padding(.bottom, Theme.Spacing.md)
        } else if let symbol {
            ZStack {
                Circle()
                    .fill(symbolUsesNovaGradient
                          ? AnyShapeStyle(Theme.Colors.novaGradient)
                          : AnyShapeStyle(Theme.Colors.focusAccentSoft))
                    .frame(width: 96, height: 96)
                Image(systemName: symbol)
                    .font(.system(size: 38, weight: .semibold))
                    .foregroundStyle(symbolUsesNovaGradient ? .white : Theme.Colors.focusAccent)
            }
        }
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AuthStore())
}
