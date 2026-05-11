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
                .tabItem {
                    Label("Mi día", systemImage: selection == .miDia ? "sun.max.fill" : "sun.max")
                }

            CalendarioView()
                .tag(Tab.calendario)
                .tabItem {
                    Label("Calendario", systemImage: selection == .calendario ? "calendar" : "calendar")
                }

            TareasView()
                .tag(Tab.tareas)
                .tabItem {
                    Label("Tareas", systemImage: selection == .tareas ? "checkmark.circle.fill" : "checkmark.circle")
                }

            AjustesView()
                .tag(Tab.ajustes)
                .tabItem {
                    Label("Ajustes", systemImage: selection == .ajustes ? "gearshape.fill" : "gearshape")
                }
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

    /// Tab bar refinada: blur ultra-thin (más liviano) + iconos algo más pequeños
    /// + labels más finos. Menos protagonista, más nativo iOS premium.
    private static func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterial)
        appearance.backgroundColor = UIColor.white.withAlphaComponent(0.78)
        appearance.shadowColor = UIColor.black.withAlphaComponent(0.04)

        // Focus accent blue para selected (#2563EB)
        let selectedColor = UIColor(red: 0.145, green: 0.388, blue: 0.922, alpha: 1.0)
        let unselectedColor = UIColor(red: 0.435, green: 0.480, blue: 0.580, alpha: 1.0)

        let selectedFont = UIFont.systemFont(ofSize: 10, weight: .semibold)
        let normalFont = UIFont.systemFont(ofSize: 10, weight: .regular)

        appearance.stackedLayoutAppearance.selected.iconColor = selectedColor
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: selectedColor,
            .font: selectedFont
        ]
        appearance.stackedLayoutAppearance.normal.iconColor = unselectedColor
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: unselectedColor,
            .font: normalFont
        ]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

#Preview {
    MainTabView()
        .environmentObject(FocusDataStore())
}
