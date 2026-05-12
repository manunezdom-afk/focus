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
    @StateObject private var toast = ToastManager()

    var body: some View {
        VStack(spacing: 0) {
            pagingContent
            customTabBar
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .environmentObject(nav)
        .environmentObject(toast)
        // NO usamos `.ignoresSafeArea(.keyboard)` global: rompía el chat de
        // Nova. El TextField del chat usa `safeAreaInset(edge: .bottom)`,
        // que necesita que la jerarquía padre RESPETE el inset del teclado
        // para anclar la barra de input arriba del teclado. Con el ignore
        // global activo, la barra quedaba escondida debajo del teclado y
        // el usuario no veía lo que escribía.
        //
        // Tradeoff: la tab bar se desliza un poco cuando aparece el teclado.
        // Aceptable — Mi Día y Calendario rara vez necesitan teclado, y
        // cuando aparece (FocusBar en Mi Día, edición de eventos), prefirimos
        // que el usuario vea su input antes de que la tab bar quede fija.
        .overlay(alignment: .top) {
            if let current = toast.current {
                ToastBanner(toast: current)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(100)
                    .animation(.spring(response: 0.4, dampingFraction: 0.85), value: toast.current)
            }
        }
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
        let isNova = tab == .nova
        return Button {
            HapticManager.shared.tick()
            withAnimation(.spring(response: 0.35, dampingFraction: 0.78)) {
                nav.selectedTab = tab
            }
        } label: {
            VStack(spacing: 3) {
                tabIcon(tab, isSelected: isSelected)
                    .frame(height: 28)
                Text(tab.title)
                    .font(.system(size: 10, weight: isSelected || isNova ? .semibold : .regular))
                    .foregroundStyle(labelStyle(for: tab, isSelected: isSelected))
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
    }

    /// Color del label de cada tab. Reglas:
    /// - Nova SIEMPRE tiene tinte de marca (gradient si está seleccionada,
    ///   acento sólido si no) — Nova es el único item con identidad
    ///   propia, los demás son sobrios.
    /// - El resto: gris textTertiary cuando NO seleccionado; textPrimary
    ///   sólido cuando SÍ — sin color de marca, mantienen jerarquía.
    /// ShapeStyle para el label de cada tab. Reglas:
    /// - Nova: gradient cuando activa, accent sólido cuando no — NUNCA gris.
    /// - Resto: textPrimary cuando activo, textTertiary cuando no.
    private func labelStyle(for tab: MainTab, isSelected: Bool) -> AnyShapeStyle {
        switch tab {
        case .nova:
            if isSelected {
                return AnyShapeStyle(
                    LinearGradient(
                        colors: [Theme.Colors.focusAccent, Theme.Colors.novaAccent],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
            } else {
                return AnyShapeStyle(Theme.Colors.novaAccent)
            }
        default:
            return AnyShapeStyle(
                isSelected ? Theme.Colors.textPrimary : Theme.Colors.textTertiary
            )
        }
    }

    @ViewBuilder
    private func tabIcon(_ tab: MainTab, isSelected: Bool) -> some View {
        switch tab {
        case .nova:
            // Nova destacada — gradient SIEMPRE para que llame la atención.
            // Cuando está seleccionada, agregamos halo violet pulsante sutil.
            ZStack {
                if isSelected {
                    Circle()
                        .fill(Theme.Colors.novaAccent.opacity(0.18))
                        .frame(width: 36, height: 36)
                        .blur(radius: 4)
                }
                NovaSparkMark(
                    size: isSelected ? 26 : 22,
                    fillColor: AnyShapeStyle(Theme.Colors.novaGradient)
                )
                .shadow(color: Theme.Colors.novaAccent.opacity(isSelected ? 0.50 : 0), radius: 6, y: 1)
            }
        default:
            // Otros tabs: gris cuando inactivo, gris oscuro cuando activo.
            // SIN color de marca — Nova es la única que tiene azul/violet.
            Image(systemName: isSelected ? tab.selectedSymbol : tab.symbol)
                .font(.system(size: isSelected ? 21 : 19, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(
                    isSelected ? Theme.Colors.textPrimary : Theme.Colors.textTertiary
                )
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(FocusDataStore())
}
