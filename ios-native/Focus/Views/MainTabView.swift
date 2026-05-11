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
    private let selectionFeedback = UISelectionFeedbackGenerator()

    init() {
        Self.configureTabBarAppearance()
    }

    var body: some View {
        TabView(selection: tabBinding) {
            MiDiaView()
                .tag(Tab.miDia)
                .tabItem { Label("Mi día", systemImage: "sun.max") }

            CalendarioView()
                .tag(Tab.calendario)
                .tabItem { Label("Calendario", systemImage: "calendar") }

            NovaView()
                .tag(Tab.nova)
                .tabItem { Label("Nova", systemImage: "sparkles") }

            TareasView()
                .tag(Tab.tareas)
                .tabItem { Label("Tareas", systemImage: "checklist") }

            AjustesView()
                .tag(Tab.ajustes)
                .tabItem { Label("Ajustes", systemImage: "gearshape") }
        }
        .tint(Theme.Colors.textPrimary)
    }

    private var tabBinding: Binding<Tab> {
        Binding(
            get: { selection },
            set: { newValue in
                if newValue != selection {
                    HapticManager.shared.tick()
                }
                selection = newValue
            }
        )
    }

    private static func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        // Fondo (#06080F)
        appearance.backgroundColor = UIColor(red: 0.024, green: 0.031, blue: 0.059, alpha: 1.0)
        appearance.shadowColor = UIColor.white.withAlphaComponent(0.08)

        let selectedColor = UIColor(red: 0.957, green: 0.965, blue: 0.980, alpha: 1.0)
        let unselectedColor = UIColor.white.withAlphaComponent(0.40)

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

#Preview {
    MainTabView()
        .environmentObject(FocusDataStore())
        .preferredColorScheme(.dark)
}
