import SwiftUI

struct TareasView: View {
    var body: some View {
        ComingSoonView(
            icon: "checklist",
            title: "Tareas",
            subtitle: "Hoy, esta semana y algún día. Con subtareas, prioridades y enlace a eventos.",
            phaseLabel: "Fase 3"
        )
    }
}

#Preview {
    TareasView()
        .preferredColorScheme(.dark)
}
