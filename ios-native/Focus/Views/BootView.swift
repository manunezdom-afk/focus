import SwiftUI

struct BootView: View {
    @State private var opacity = 0.0
    @State private var yOffset = 8.0

    private let background = Color(red: 0.024, green: 0.031, blue: 0.059)

    var body: some View {
        ZStack {
            background.ignoresSafeArea()

            VStack(spacing: 10) {
                Text("Focus")
                    .font(.system(size: 38, weight: .semibold, design: .default))
                    .foregroundStyle(.white)
                    .tracking(0.5)

                Text("Tu día, ordenado.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(.white.opacity(0.38))
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
