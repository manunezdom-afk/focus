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
    /// Fecha pendiente a la que el Calendario debe saltar al cargarse. La
    /// setea quien navegue (ej. el preview "Mañana" de Mi Día → mañana en
    /// calendario) y `CalendarioView` la consume y la limpia en su `.task`.
    @Published var pendingCalendarDate: Date? = nil

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

    /// Lleva al usuario a la tab Calendario seleccionando una fecha concreta.
    /// `CalendarioView` consume `pendingCalendarDate` y lo limpia para que el
    /// usuario pueda navegar después con normalidad.
    func openCalendar(on date: Date) {
        pendingCalendarDate = Calendar.current.startOfDay(for: date)
        withAnimation(.easeInOut(duration: 0.28)) {
            selectedTab = .calendario
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
    @State private var isKeyboardVisible = false
    /// Namespace para `matchedGeometryEffect` del indicator de tab seleccionada.
    /// La cápsula de fondo "vuela" entre tabs cuando cambia la selección.
    @Namespace private var tabSelectionNamespace

    var body: some View {
        VStack(spacing: 0) {
            pagingContent
            if !isKeyboardVisible {
                customTabBar
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.22), value: isKeyboardVisible)
        .background(Theme.Colors.background.ignoresSafeArea())
        .environmentObject(nav)
        .environmentObject(toast)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            isKeyboardVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            isKeyboardVisible = false
        }
        // Cuando el usuario toca una notificación local de recordatorio,
        // saltamos a Mi Día — ahí ve el bloque del evento en el timeline.
        // El listener se monta al app launch (porque MainTabView vive
        // mientras dura la sesión) y queda activo en todo momento.
        .onReceive(NotificationCenter.default.publisher(for: .focusReminderTapped)) { _ in
            withAnimation(.easeInOut(duration: 0.28)) {
                nav.selectedTab = .miDia
            }
        }
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

    // MARK: - Custom tab bar (Theme 2.0 — píldora flotante Z-2)
    //
    // Antes: barra ancha del 100% pegada al safe area inferior con material
    // ultraThin + tinte blanco. Funcional pero indistinguible del default iOS.
    //
    // Ahora: píldora flotante separada del safe area inferior, con material
    // ultraThin + tinte Nova 4%, hairline border, sombra Z-2 elevated. La
    // selección viaja entre tabs como una cápsula que "flota" usando
    // matchedGeometryEffect — la selección se siente física, no como un
    // simple cambio de color.

    private var customTabBar: some View {
        HStack(spacing: 0) {
            ForEach(MainTab.allCases, id: \.self) { tab in
                tabButton(tab)
            }
        }
        .frame(height: 64)
        .padding(.horizontal, 6)
        // Theme 2.0 FASE 2: tinte Nova MÁS visible (10% vs 4%) + sombra
        // elevated más fuerte para que la píldora realmente se sienta
        // suspendida sobre el canvas. Border Nova en lugar de hairline
        // gris — la barra cobra identidad violet visible.
        .background(
            ZStack {
                Capsule(style: .continuous)
                    .fill(.ultraThinMaterial)
                Capsule(style: .continuous)
                    .fill(Theme.Colors.novaAccent.opacity(0.10))
            }
        )
        .overlay(
            Capsule(style: .continuous)
                .strokeBorder(Theme.Colors.novaAccent.opacity(0.18), lineWidth: 0.7)
        )
        .shadow(color: Theme.Colors.novaAccent.opacity(0.20), radius: 22, x: 0, y: 12)
        .shadow(color: Theme.Colors.cardShadowStrong, radius: 8, x: 0, y: 4)
        .padding(.horizontal, Theme.Spacing.xl)
        .padding(.bottom, 8)
    }

    private func tabButton(_ tab: MainTab) -> some View {
        let isSelected = nav.selectedTab == tab
        let isNova = tab == .nova
        return Button {
            HapticManager.shared.tick()
            withAnimation(Theme.Spring.settle) {
                nav.selectedTab = tab
            }
        } label: {
            ZStack {
                // Cápsula deslizante del estado seleccionado — vuela entre tabs
                // con matchedGeometryEffect. Tinte sutil tonal según tab.
                if isSelected {
                    Capsule(style: .continuous)
                        .fill(
                            isNova
                                ? Theme.Colors.novaAccent.opacity(0.10)
                                : Theme.Colors.textPrimary.opacity(0.06)
                        )
                        .overlay(
                            Capsule(style: .continuous)
                                .strokeBorder(
                                    isNova
                                        ? Theme.Colors.novaAccent.opacity(0.18)
                                        : Theme.Colors.borderHairline,
                                    lineWidth: Theme.Stroke.hairline
                                )
                        )
                        .matchedGeometryEffect(id: "tabSelection", in: tabSelectionNamespace)
                        .padding(.vertical, 6)
                        .padding(.horizontal, 4)
                }

                VStack(spacing: 2) {
                    tabIcon(tab, isSelected: isSelected)
                        .frame(height: 28)
                    Text(tab.title)
                        .font(.system(size: 10, weight: isSelected || isNova ? .semibold : .regular))
                        .foregroundStyle(labelStyle(for: tab, isSelected: isSelected))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
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
            // Cuando está seleccionada, agregamos halo violet pulsante sutil
            // + micro-pop de escala via spring (Theme 2.0).
            ZStack {
                if isSelected {
                    Circle()
                        .fill(Theme.Colors.novaAccent.opacity(0.18))
                        .frame(width: 36, height: 36)
                        .blur(radius: 4)
                }
                NovaSparkMark(
                    size: isSelected ? 26 : 22,
                    fillColor: AnyShapeStyle(Theme.Colors.novaPrismGradient)
                )
                .shadow(color: Theme.Colors.novaAccent.opacity(isSelected ? 0.50 : 0), radius: 6, y: 1)
            }
            .scaleEffect(isSelected ? 1.08 : 1.0)
            .animation(Theme.Spring.pop, value: isSelected)
        default:
            // Otros tabs: gris cuando inactivo, gris oscuro cuando activo.
            // SIN color de marca — Nova es la única con violeta/cobalto.
            Image(systemName: isSelected ? tab.selectedSymbol : tab.symbol)
                .font(.system(size: isSelected ? 21 : 19, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(
                    isSelected ? Theme.Colors.textPrimary : Theme.Colors.textTertiary
                )
                .scaleEffect(isSelected ? 1.08 : 1.0)
                .animation(Theme.Spring.pop, value: isSelected)
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(FocusDataStore())
}
