import SwiftUI

struct CalendarioView: View {
    var body: some View {
        ComingSoonView(
            icon: "calendar",
            title: "Calendario",
            subtitle: "Tu semana y tu mes en una vista limpia. Pronto vas a poder navegar y crear eventos desde acá.",
            phaseLabel: "Fase 4"
        )
    }
}

#Preview {
    CalendarioView()
        .preferredColorScheme(.dark)
}
