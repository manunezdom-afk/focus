import SwiftUI

struct AjustesView: View {
    var body: some View {
        ComingSoonView(
            icon: "gearshape",
            title: "Ajustes",
            subtitle: "Cuenta, plan, personalidad de Nova, notificaciones y privacidad.",
            phaseLabel: "Fase 8"
        )
    }
}

#Preview {
    AjustesView()
        .preferredColorScheme(.dark)
}
