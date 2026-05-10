import SwiftUI

struct HomeView: View {
    private let background = Color(red: 0.024, green: 0.031, blue: 0.059)
    private let cardFill = Color.white.opacity(0.05)
    private let cardBorder = Color.white.opacity(0.08)

    var body: some View {
        NavigationStack {
            ZStack {
                background.ignoresSafeArea()

                VStack(alignment: .leading, spacing: 0) {
                    header
                        .padding(.horizontal, 22)
                        .padding(.top, 20)
                        .padding(.bottom, 28)

                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 12) {
                            sectionLabel("Próximo")
                            placeholderBlock(height: 80)

                            sectionLabel("Tareas pendientes")
                                .padding(.top, 8)
                            placeholderBlock(height: 60)
                            placeholderBlock(height: 60)
                            placeholderBlock(height: 60)
                        }
                        .padding(.horizontal, 22)
                        .padding(.bottom, 40)
                    }

                    Spacer(minLength: 0)

                    phaseTag
                        .padding(.bottom, 36)
                }
            }
            .navigationBarHidden(true)
        }
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 3) {
                Text(todayFormatted)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(.white.opacity(0.4))
                Text("Mi Día")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(.white)
            }
            Spacer()
            Circle()
                .fill(Color.white.opacity(0.08))
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: "person.crop.circle")
                        .font(.system(size: 16))
                        .foregroundStyle(.white.opacity(0.45))
                )
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        HStack {
            Text(text.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white.opacity(0.3))
                .tracking(0.8)
            Spacer()
        }
    }

    private func placeholderBlock(height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(cardFill)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(cardBorder, lineWidth: 0.5)
            )
            .frame(height: height)
            .overlay(
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.white.opacity(0.07))
                        .frame(width: 36, height: 36)
                    VStack(alignment: .leading, spacing: 6) {
                        Capsule()
                            .fill(Color.white.opacity(0.1))
                            .frame(width: 110, height: 10)
                        Capsule()
                            .fill(Color.white.opacity(0.06))
                            .frame(width: 72, height: 8)
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)
            )
    }

    private var phaseTag: some View {
        HStack {
            Spacer()
            Text("Fase 2 → autenticación + datos reales")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.white.opacity(0.2))
            Spacer()
        }
    }

    private var todayFormatted: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "EEEE, d MMM"
        fmt.locale = Locale(identifier: "es_ES")
        return fmt.string(from: Date()).capitalized
    }
}

#Preview {
    HomeView()
}
