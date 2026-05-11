import SwiftUI
import UIKit

struct MainTabView: View {
    enum Tab: Hashable {
        case miDia
        case calendario
        case tareas
        case ajustes
    }

    @State private var selection: Tab = .miDia

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

            TareasView()
                .tag(Tab.tareas)
                .tabItem { Label("Tareas", systemImage: "checkmark.circle") }

            AjustesView()
                .tag(Tab.ajustes)
                .tabItem { Label("Ajustes", systemImage: "gearshape") }
        }
        .tint(Theme.Colors.focusAccent)
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
        appearance.configureWithDefaultBackground()
        // Fondo blanco con leve blur
        appearance.backgroundColor = UIColor.white.withAlphaComponent(0.96)
        appearance.shadowColor = UIColor.black.withAlphaComponent(0.06)

        // Azul focus accent para selected (#2563EB)
        let selectedColor = UIColor(red: 0.145, green: 0.388, blue: 0.922, alpha: 1.0)
        // Slate-400 para unselected
        let unselectedColor = UIColor(red: 0.580, green: 0.639, blue: 0.722, alpha: 1.0)

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
}
