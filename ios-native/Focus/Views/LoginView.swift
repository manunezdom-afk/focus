import SwiftUI

/// Pantalla de autenticación con OTP por email.
/// Sigue el estado de `AuthStore`: `.loggedOut` → email step; `.codeSent` → code step.
/// Ofrece "Continuar en modo demo" para usuarios que no quieren registrarse.
struct LoginView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var email: String = ""
    @State private var code: String = ""
    @FocusState private var emailFocused: Bool
    @FocusState private var codeFocused: Bool

    var body: some View {
        ZStack {
            Theme.Colors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer(minLength: Theme.Spacing.huge)
                brand
                Spacer(minLength: Theme.Spacing.huge)
                content
                    .padding(.horizontal, Theme.Spacing.xl)
                Spacer()
                demoLink
                    .padding(.bottom, Theme.Spacing.xxl)
            }
        }
    }

    // MARK: - Brand header (logo + nombre + subtítulo)

    private var brand: some View {
        VStack(spacing: Theme.Spacing.md) {
            FocusLogoMark(size: 78)
                .padding(.bottom, Theme.Spacing.sm)

            Text("Focus")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(Theme.Colors.textPrimary)
                .tracking(0.3)

            Text("Organiza tu día con Nova.")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
    }

    // MARK: - Step routing

    @ViewBuilder
    private var content: some View {
        switch auth.state {
        case .codeSent(let sentEmail):
            codeStep(sentEmail: sentEmail)
        default:
            emailStep
        }
    }

    // MARK: - Step 1: Email

    private var emailStep: some View {
        VStack(spacing: Theme.Spacing.lg) {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: "envelope.fill")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Theme.Colors.textTertiary)
                TextField("tu correo", text: $email)
                    .focused($emailFocused)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .tint(Theme.Colors.focusAccent)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .submitLabel(.send)
                    .onSubmit { Task { await submitEmail() } }
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.vertical, Theme.Spacing.md + 2)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.xxl, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.xxl, style: .continuous)
                            .strokeBorder(
                                emailFocused ? Theme.Colors.focusAccent.opacity(0.5) : Theme.Colors.border,
                                lineWidth: emailFocused ? 1.5 : Theme.Stroke.hairline
                            )
                    )
                    .focusCardShadow()
            )

            primaryButton(
                title: "Enviar código",
                isLoading: auth.isWorking,
                isEnabled: !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !auth.isWorking
            ) {
                Task { await submitEmail() }
            }

            if let err = auth.lastError {
                errorBanner(err)
            }
        }
    }

    private func submitEmail() async {
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        emailFocused = false
        await auth.sendOTP(email: email)
        if case .codeSent = auth.state {
            code = ""
            // Auto-focus code field con leve delay (sheets necesitan render)
            try? await Task.sleep(nanoseconds: 250_000_000)
            codeFocused = true
        }
    }

    // MARK: - Step 2: Code

    private func codeStep(sentEmail: String) -> some View {
        VStack(spacing: Theme.Spacing.lg) {
            VStack(spacing: 6) {
                Text("Te escribimos un código a")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                Text(sentEmail)
                    .font(Theme.Typography.bodyBold)
                    .foregroundStyle(Theme.Colors.textPrimary)
            }
            .multilineTextAlignment(.center)
            .padding(.bottom, Theme.Spacing.sm)

            // Input de 6 dígitos
            TextField("000000", text: $code)
                .focused($codeFocused)
                .font(.system(size: 28, weight: .semibold, design: .monospaced))
                .foregroundStyle(Theme.Colors.textPrimary)
                .tint(Theme.Colors.focusAccent)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .multilineTextAlignment(.center)
                .padding(.vertical, Theme.Spacing.lg)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .fill(Theme.Colors.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                                .strokeBorder(
                                    codeFocused ? Theme.Colors.focusAccent.opacity(0.5) : Theme.Colors.border,
                                    lineWidth: codeFocused ? 1.5 : Theme.Stroke.hairline
                                )
                        )
                        .focusCardShadow()
                )
                .onChange(of: code) { _, newValue in
                    // Limpiar caracteres no-numéricos
                    let filtered = newValue.filter(\.isNumber)
                    if filtered != newValue {
                        code = filtered
                    }
                    // Auto-submit cuando llega a 6 dígitos
                    if filtered.count == 6 {
                        Task { await submitCode() }
                    }
                }

            primaryButton(
                title: "Verificar",
                isLoading: auth.isWorking,
                isEnabled: code.count >= 6 && !auth.isWorking
            ) {
                Task { await submitCode() }
            }

            if let err = auth.lastError {
                errorBanner(err)
            }

            HStack(spacing: Theme.Spacing.lg) {
                Button("Cambiar correo") {
                    auth.changeEmail()
                    email = ""
                    code = ""
                }
                .font(Theme.Typography.subheadEmphasized)
                .foregroundStyle(Theme.Colors.textSecondary)

                Text("·")
                    .foregroundStyle(Theme.Colors.textQuaternary)

                Button {
                    Task { await auth.resendCode() }
                } label: {
                    Text("Reenviar código")
                        .font(Theme.Typography.subheadEmphasized)
                        .foregroundStyle(Theme.Colors.focusAccent)
                }
                .disabled(auth.isWorking)
            }
            .padding(.top, Theme.Spacing.xs)
        }
    }

    private func submitCode() async {
        codeFocused = false
        await auth.verifyOTP(token: code)
    }

    // MARK: - Demo link

    private var demoLink: some View {
        Button {
            auth.enterDemo()
        } label: {
            Text("Continuar en modo demo")
                .font(Theme.Typography.subheadEmphasized)
                .foregroundStyle(Theme.Colors.textSecondary)
                .underline(true, color: Theme.Colors.textTertiary)
                .padding(.horizontal, Theme.Spacing.xl)
                .padding(.vertical, Theme.Spacing.sm)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Components

    private func primaryButton(
        title: String,
        isLoading: Bool,
        isEnabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            ZStack {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text(title)
                        .font(Theme.Typography.bodyBold)
                        .foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.md + 2)
            .background(
                Capsule()
                    .fill(isEnabled ? Theme.Colors.focusAccent : Theme.Colors.focusAccent.opacity(0.35))
                    .shadow(
                        color: isEnabled ? Theme.Colors.focusAccent.opacity(0.30) : .clear,
                        radius: 12, x: 0, y: 4
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Colors.danger)
            Text(message)
                .font(Theme.Typography.subhead)
                .foregroundStyle(Theme.Colors.textPrimary)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.md + 2)
        .padding(.vertical, Theme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                .fill(Theme.Colors.danger.opacity(0.10))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                        .strokeBorder(Theme.Colors.danger.opacity(0.30), lineWidth: Theme.Stroke.hairline)
                )
        )
        .transition(.opacity)
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthStore())
}
