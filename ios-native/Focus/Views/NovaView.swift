import SwiftUI

struct NovaView: View {
    var body: some View {
        ComingSoonView(
            icon: "sparkles",
            title: "Nova",
            subtitle: "Tu asistente. Hablale por voz, texto o foto y deja que organice tu día.",
            phaseLabel: "Fase 6"
        )
    }
}

#Preview {
    NovaView()
        .preferredColorScheme(.dark)
}
