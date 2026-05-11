import SwiftUI

struct BootView: View {
    @State private var opacity = 0.0
    @State private var yOffset = 8.0

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            VStack(spacing: 14) {
                // Logo "diamante" Gemini-style con gradiente
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Theme.Colors.novaGradient)
                        .frame(width: 56, height: 56)
                        .rotationEffect(.degrees(45))
                        .focusCardShadow(strong: true)

                    Image(systemName: "sparkle")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .padding(.bottom, 6)

                Text("Focus")
                    .font(.system(size: 38, weight: .semibold, design: .default))
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .tracking(0.3)

                Text("Tu día, ordenado.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .opacity(opacity)
            .offset(y: yOffset)
            .onAppear {
                withAnimation(.easeOut(duration: 0.7)) {
                    opacity = 1
                    yOffset = 0
                }
            }
        }
    }
}

#Preview {
    BootView()
}
