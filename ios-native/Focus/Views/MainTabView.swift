import SwiftUI
import UIKit

struct MainTabView: View {
    enum Tab: Hashable {
        case miDia
        case calendario
        case nova
        case tareas
        case ajustes
    }

    @State private var selection: Tab = .miDia

    init() {
        Self.configureTabBarAppearance()
    }

    var body: some View {
        TabView(selection: $selection) {
            MiDiaView()
                .tag(Tab.miDia)
                .tabItem {
                    Label("Mi día", systemImage: "sun.max")
                }

            CalendarioView()
                .tag(Tab.calendario)
                .tabItem {
                    Label("Calendario", systemImage: "calendar")
                }

            NovaView()
                .tag(Tab.nova)
                .tabItem {
                    Label("Nova", systemImage: "sparkles")
                }

            TareasView()
                .tag(Tab.tareas)
                .tabItem {
                    Label("Tareas", systemImage: "checklist")
                }

            AjustesView()
                .tag(Tab.ajustes)
                .tabItem {
                    Label("Ajustes", systemImage: "gearshape")
                }
        }
        .tint(Theme.Colors.textPrimary)
    }

    private static func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(red: 0.024, green: 0.031, blue: 0.059, alpha: 1.0)
        appearance.shadowColor = UIColor.white.withAlphaComponent(0.06)

        let selectedColor = UIColor.white
        let unselectedColor = UIColor.white.withAlphaComponent(0.42)

        appearance.stackedLayoutAppearance.selected.iconColor = selectedColor
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: selectedColor,
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold)
        ]
        appearance.stackedLayoutAppearance.normal.iconColor = unselectedColor
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: unselectedColor,
            .font: UIFont.systemFont(ofSize: 10, weight: .medium)
        ]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

// Placeholder reutilizable para tabs todavía no implementadas (Fases 3-8).
struct ComingSoonView: View {
    let icon: String
    let title: String
    let subtitle: String
    let phaseLabel: String

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            VStack(spacing: Theme.Spacing.xl) {
                Spacer()

                Image(systemName: icon)
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(Theme.Colors.accent.opacity(0.85))
                    .padding(Theme.Spacing.xxl)
                    .background(
                        Circle()
                            .fill(Theme.Colors.surfaceElevated)
                            .overlay(
                                Circle()
                                    .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                            )
                    )

                VStack(spacing: Theme.Spacing.sm) {
                    Text(title)
                        .font(Theme.Typography.title)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text(subtitle)
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 280)
                }

                Text(phaseLabel.uppercased())
                    .font(Theme.Typography.captionEmphasized)
                    .foregroundStyle(Theme.Colors.accent)
                    .tracking(1.2)
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(Theme.Colors.surface)
                            .overlay(
                                Capsule()
                                    .strokeBorder(Theme.Colors.accent.opacity(0.35), lineWidth: Theme.Stroke.hairline)
                            )
                    )

                Spacer()
                Spacer()
            }
            .padding(Theme.Spacing.xl)
        }
    }
}

#Preview {
    MainTabView()
        .preferredColorScheme(.dark)
}
