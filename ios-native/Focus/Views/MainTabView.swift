import SwiftUI
import UIKit

// MARK: - Tabs principales

/// Las 4 tabs principales de la app. "Tareas" ya no es una tab principal —
/// la funcionalidad de tareas vive ahora dentro de Mi Día (pendientes
/// compactos) y Nova (revisar pendientes / decisiones).
enum MainTab: Hashable, CaseIterable {
    case miDia
    case calendario
    case nova
    case ajustes

    var title: String {
        switch self {
        case .miDia: return "Mi día"
        case .calendario: return "Calendario"
        case .nova: return "Nova"
        case .ajustes: return "Ajustes"
        }
    }

    var symbol: String {
        switch self {
        case .miDia: return "sun.max"
        case .calendario: return "calendar"
        // diamond.fill mapea al rombo de NovaSparkMark — identidad propia, no
        // un sparkle 4-point genérico.
        case .nova: return "diamond.fill"
        case .ajustes: return "gearshape"
        }
    }

    var selectedSymbol: String {
        switch self {
        case .miDia: return "sun.max.fill"
        case .calendario: return "calendar"
        case .nova: return "diamond.fill"
        case .ajustes: return "gearshape.fill"
        }
    }
}

/// Segmentos internos de la tab Nova.
enum NovaSegment: Hashable {
    case bandeja
    case acciones
    case chat
}

// MARK: - Navigation coordinator

/// Estado global de navegación. Vive como `@StateObject` en `MainTabView` y se
/// inyecta a los hijos como `@EnvironmentObject`. Permite que Mi Día (u otras
/// pantallas) abran Nova en un segmento específico y opcionalmente pre-cargue
/// un mensaje para enviarle.
@MainActor
final class NavigationCoordinator: ObservableObject {
    @Published var selectedTab: MainTab = .miDia
    @Published var novaSegment: NovaSegment = .bandeja
    /// Mensaje pendiente para enviar a Nova cuando se abra Chat. Se consume y
    /// limpia en `NovaView.onAppear`.
    @Published var pendingNovaPrompt: String? = nil

    /// Lleva al usuario a la tab Nova, opcionalmente seteando el segmento y un
    /// prompt inicial. Si se pasa un prompt no nulo, Nova arranca en .chat.
    func openNova(prompt: String? = nil, segment: NovaSegment? = nil) {
        if let prompt, !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            pendingNovaPrompt = prompt
            novaSegment = segment ?? .chat
        } else if let segment {
            novaSegment = segment
        }
        withAnimation(.easeInOut(duration: 0.28)) {
            selectedTab = .nova
        }
        HapticManager.shared.tick()
    }
}

// MARK: - Main tab container (paging horizontal + tab bar custom)

/// Contenedor principal: 4 vistas en un paging horizontal con custom tab bar
/// al fondo. Soporta swipe entre tabs (gesto nativo de `ScrollView .paging`).
struct MainTabView: View {
    @StateObject private var nav = NavigationCoordinator()

    var body: some View {
        VStack(spacing: 0) {
            pagingContent
            customTabBar
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .environmentObject(nav)
        // El teclado no desplaza la tab bar — los inputs internos manejan su
        // propio padding bottom-safe.
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    // MARK: - Contenido paginable

    /// Eager HStack (no Lazy) para preservar el estado de cada tab cuando el
    /// usuario navega. Con 4 vistas la memoria es aceptable.
    private var pagingContent: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(MainTab.allCases, id: \.self) { tab in
                    tabContent(tab)
                        .containerRelativeFrame(.horizontal)
                        .id(tab)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: selectedTabBinding)
        .scrollDismissesKeyboard(.immediately)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func tabContent(_ tab: MainTab) -> some View {
        switch tab {
        case .miDia:      MiDiaView()
        case .calendario: CalendarioView()
        case .nova:       NovaView()
        case .ajustes:    AjustesView()
        }
    }

    private var selectedTabBinding: Binding<MainTab?> {
        Binding(
            get: { nav.selectedTab },
            set: { newValue in
                if let value = newValue, value != nav.selectedTab {
                    HapticManager.shared.tick()
                    nav.selectedTab = value
                }
            }
        )
    }

    // MARK: - Custom tab bar

    private var customTabBar: some View {
        HStack(spacing: 0) {
            ForEach(MainTab.allCases, id: \.self) { tab in
                tabButton(tab)
            }
        }
        .padding(.horizontal, Theme.Spacing.sm)
        .padding(.top, Theme.Spacing.xs + 2)
        .padding(.bottom, Theme.Spacing.xs + 2)
        .background(
            ZStack {
                Rectangle()
                    .fill(.ultraThinMaterial)
                Rectangle()
                    .fill(Color.white.opacity(0.55))
            }
            .ignoresSafeArea(edges: .bottom)
        )
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: Theme.Stroke.hairline)
                .opacity(0.6)
        }
    }

    private func tabButton(_ tab: MainTab) -> some View {
        let isSelected = nav.selectedTab == tab
        return Button {
            HapticManager.shared.tick()
            withAnimation(.easeInOut(duration: 0.28)) {
                nav.selectedTab = tab
            }
        } label: {
            VStack(spacing: 2) {
                tabIcon(tab, isSelected: isSelected)
                    .frame(height: 24)
                Text(tab.title)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(
                        isSelected ? Theme.Colors.focusAccent : Theme.Colors.textTertiary
                    )
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
    }

    @ViewBuilder
    private func tabIcon(_ tab: MainTab, isSelected: Bool) -> some View {
        let color = isSelected ? Theme.Colors.focusAccent : Theme.Colors.textTertiary
        switch tab {
        case .nova:
            // Marca propia de Nova — rombo cobalto, con resaltado cuando está
            // seleccionada (gradiente; si no, color uniforme).
            if isSelected {
                NovaSparkMark(
                    size: 22,
                    fillColor: AnyShapeStyle(Theme.Colors.novaGradient)
                )
            } else {
                NovaSparkMark(size: 22, fillColor: AnyShapeStyle(color))
            }
        default:
            Image(systemName: isSelected ? tab.selectedSymbol : tab.symbol)
                .font(.system(size: 19, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(color)
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(FocusDataStore())
}
