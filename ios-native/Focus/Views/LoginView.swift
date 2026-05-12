import SwiftUI
import AuthenticationServices
import UIKit

/// Pantalla de autenticación con OTP por email.
/// Sigue el estado de `AuthStore`: `.loggedOut` → email step; `.codeSent` → code step.
/// Ofrece "Continuar en modo demo" para usuarios que no quieren registrarse.
struct LoginView: View {

    /// **Feature flag de Google Sign-In.** Cuando es `false`, el botón
    /// "Continuar con Google" + el divider "o" NO se renderizan. Toda la
    /// lógica subyacente (AuthService.signInWithGoogle, AuthStore action,
    /// callback handling) sigue intacta — solo se oculta la UI.
    ///
    /// **Por qué está en false para beta**: ASWebAuthenticationSession
    /// muestra el host técnico de Supabase (`hvwqeemtfoyvfmongwzo...`) en
    /// el prompt "Focus quiere utilizar...". Eso genera desconfianza tipo
    /// phishing en testers nuevos. Soluciones reales (documentadas en
    /// FOCUS_AUDIT_MASTER.md pase 55):
    /// - **Path A**: GoogleSignIn SDK nativo (iOS client + Supabase
    ///   signInWithIdToken). Requiere ~4-6h de trabajo + test en device.
    /// - **Path B**: Supabase Custom Auth Domain (Pro plan $25/mes).
    ///   Cambio mínimo de código (solo FocusConfig.supabaseURL).
    /// Cuando Martin elija un path y termine la migración → flip a `true`.
    private static let isGoogleSignInEnabled = false
    @EnvironmentObject private var auth: AuthStore
    @State private var email: String = ""
    @State private var code: String = ""
    @State private var googleNotice: String? = nil
    @State private var localError: String? = nil
    @State private var resendCooldownSeconds: Int = 0
    @State private var resendTimer: Task<Void, Never>? = nil
    @FocusState private var emailFocused: Bool
    @FocusState private var codeFocused: Bool
    /// Fade-in interno cuando la vista aparece (después de BootView u
    /// onboarding). NO usa transition de root — eso causaba el bug de
    /// pantallas duplicadas. Cada view raíz hace su propio fade.
    @State private var contentVisible: Bool = false

    /// Regex razonable: algo@algo.dominio. Bloquea casos básicos como
    /// "a@", "@b.com", "no-arroba". No es RFC 5322 completo a propósito.
    private static let emailRegex = #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#

    private func isValidEmail(_ raw: String) -> Bool {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.range(of: Self.emailRegex, options: .regularExpression) != nil
    }

    var body: some View {
        rootContent
            .opacity(contentVisible ? 1 : 0)
            .onAppear {
                // Fade-in inmediato al montarse — la transición suave la
                // hace la propia view, NO el root. Si lo hiciera el root,
                // SwiftUI crossfadeaba con BootView/Onboarding y se veían
                // capas duplicadas (bug del pase 48).
                withAnimation(.easeOut(duration: 0.28)) {
                    contentVisible = true
                }
                // Auto-focus en email al entrar a la pantalla.
                if case .codeSent = auth.state { return }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    emailFocused = true
                }
            }
            .onChange(of: auth.state) { _, newState in
                // Auto-focus en código apenas Auth pase a .codeSent.
                if case .codeSent = newState {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.30) {
                        codeFocused = true
                    }
                    startResendCooldown()
                }
                // Si pasamos a loggedIn/loggedOut/demo desde codeSent
                // (success o cancelación), limpiar ambos focus states
                // para que al volver a aparecer LoginView el teclado
                // NO se abra solo.
                if case .codeSent = newState {} else {
                    emailFocused = false
                    codeFocused = false
                }
            }
            .onDisappear {
                resendTimer?.cancel()
                resendTimer = nil
            }
    }

    private var rootContent: some View {
        ZStack {
            // Background con tinte azul sutil + tap-anywhere-dismiss.
            // El Color tiene `contentShape` para hacer la zona completa
            // tappable. Cualquier tap en zonas vacías (logo, gradient,
            // entre input y botón, etc.) cierra el teclado sin
            // interferir con los taps de TextField/botón (que tienen
            // mayor prioridad de hit-test).
            Theme.Colors.background
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { dismissKeyboard() }

            VStack(spacing: 0) {
                LinearGradient(
                    colors: [
                        Theme.Colors.focusAccent.opacity(0.10),
                        Theme.Colors.background
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 360)
                Spacer()
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)  // el gradient no debe robar taps

            VStack(spacing: 0) {
                Spacer(minLength: Theme.Spacing.xxxl)
                brand
                Spacer(minLength: Theme.Spacing.xxxl)
                content
                    .padding(.horizontal, Theme.Spacing.xl)
                Spacer()
                demoLink
                    .padding(.bottom, Theme.Spacing.xxl)
            }
        }
    }

    /// Centraliza el dismiss del teclado para los dos `@FocusState` que
    /// usa esta pantalla. Llamada desde tap-outside y desde el botón
    /// "Listo" del toolbar.
    private func dismissKeyboard() {
        emailFocused = false
        codeFocused = false
    }

    // MARK: - Brand header (logo + nombre + subtítulo)

    private var brand: some View {
        VStack(spacing: Theme.Spacing.md) {
            FocusLogoMark(size: 108)
                .padding(.bottom, Theme.Spacing.md)

            Text("Focus")
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(Theme.Colors.textPrimary)
                .tracking(0.3)

            Text("Entra a tu sistema de organización personal.")
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
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
                    .toolbar {
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button("Listo") { dismissKeyboard() }
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.Colors.focusAccent)
                        }
                    }
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

            if let local = localError {
                errorBanner(local)
            }

            // Google Sign-In gated por feature flag. Hidden para beta —
            // ver comment en `isGoogleSignInEnabled` arriba para por qué
            // y cómo re-habilitar.
            if Self.isGoogleSignInEnabled {
                orDivider
                googleButton
                if let notice = googleNotice {
                    noticeBanner(notice)
                }
            }

            if let err = auth.lastError {
                errorBanner(err)
            }
        }
    }

    // MARK: - "o" divider entre métodos de login

    private var orDivider: some View {
        HStack(spacing: Theme.Spacing.md) {
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: Theme.Stroke.hairline)
            Text("o")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary)
                .tracking(0.5)
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: Theme.Stroke.hairline)
        }
        .padding(.vertical, Theme.Spacing.xs)
    }

    // MARK: - Google sign-in (placeholder visual; OAuth real va en backlog)

    private var googleButton: some View {
        Button {
            HapticManager.shared.tap()
            startGoogleSignIn()
        } label: {
            HStack(spacing: Theme.Spacing.md) {
                if auth.isWorking {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .controlSize(.small)
                        .tint(Color(red: 0.231, green: 0.247, blue: 0.275))
                } else {
                    GoogleGMark(size: 18)
                }
                Text("Continuar con Google")
                    .font(Theme.Typography.bodyBold)
                    .foregroundStyle(Color(red: 0.231, green: 0.247, blue: 0.275))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.md + 4)
            .background(
                Capsule()
                    .fill(Color.white)
                    .overlay(
                        Capsule()
                            .strokeBorder(
                                Color(red: 0.85, green: 0.86, blue: 0.88),
                                lineWidth: 1
                            )
                    )
                    .shadow(
                        color: Color.black.opacity(0.06),
                        radius: 8,
                        x: 0,
                        y: 2
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(auth.isWorking)
    }

    /// Lanza el flujo de Google Sign-In. Prefiere el SDK NATIVO (no muestra
    /// host técnico de Supabase). Cuando el flag `isGoogleSignInEnabled`
    /// esté true Y el SDK GoogleSignIn esté instalado en el target, este
    /// método ejecuta el flow nativo. La rama ASWebAuthenticationSession
    /// queda como fallback histórico (deprecated, mantener hasta validar
    /// nativo en device).
    private func startGoogleSignIn() {
        dismissKeyboard()
        guard let topVC = resolveTopViewController() else {
            googleNotice = "No pudimos abrir el login de Google. Vuelve a intentar."
            return
        }
        googleNotice = nil
        Task { await auth.signInWithGoogleNative(presenter: topVC) }
    }

    /// Resuelve el `UIViewController` activo en la escena foreground.
    /// El SDK de GoogleSignIn necesita un presenter — no un anchor de
    /// window. Buscamos la topmost VC (cubre casos con sheets, alerts,
    /// nav stacks anidados).
    private func resolveTopViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
        for case let scene as UIWindowScene in scenes
            where scene.activationState == .foregroundActive {
            guard let window = scene.windows.first(where: { $0.isKeyWindow })
                ?? scene.windows.first else { continue }
            var current = window.rootViewController
            while let presented = current?.presentedViewController {
                current = presented
            }
            return current
        }
        return nil
    }

    private func noticeBanner(_ message: String) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Colors.focusAccent)
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
                .fill(Theme.Colors.focusAccentSoft)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                        .strokeBorder(Theme.Colors.focusAccent.opacity(0.25), lineWidth: Theme.Stroke.hairline)
                )
        )
        .transition(.opacity)
    }

    private func submitEmail() async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            localError = "Escribe tu correo para continuar."
            HapticManager.shared.warning()
            return
        }
        guard isValidEmail(trimmed) else {
            localError = "El correo no parece válido. Revisa el formato."
            HapticManager.shared.warning()
            return
        }
        localError = nil
        emailFocused = false
        await auth.sendOTP(email: trimmed)
        if case .codeSent = auth.state {
            code = ""
            // Auto-focus code field con leve delay (sheets necesitan render)
            try? await Task.sleep(nanoseconds: 250_000_000)
            codeFocused = true
        }
    }

    // MARK: - Resend cooldown

    private func startResendCooldown() {
        resendTimer?.cancel()
        resendCooldownSeconds = 30
        resendTimer = Task { @MainActor in
            while resendCooldownSeconds > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { return }
                resendCooldownSeconds = max(0, resendCooldownSeconds - 1)
            }
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
                    Task {
                        await auth.resendCode()
                        startResendCooldown()
                    }
                } label: {
                    Text(resendCooldownSeconds > 0
                         ? "Reenviar en \(resendCooldownSeconds) s"
                         : "Reenviar código")
                        .font(Theme.Typography.subheadEmphasized)
                        .foregroundStyle(
                            resendCooldownSeconds > 0
                                ? Theme.Colors.textTertiary
                                : Theme.Colors.focusAccent
                        )
                }
                .disabled(auth.isWorking || resendCooldownSeconds > 0)
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
            .padding(.vertical, Theme.Spacing.md + 4)
            .background(
                Capsule()
                    .fill(
                        isEnabled
                        ? AnyShapeStyle(LinearGradient(
                            colors: [
                                Theme.Colors.focusAccent,
                                Theme.Colors.focusAccentHover
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing))
                        : AnyShapeStyle(Theme.Colors.focusAccent.opacity(0.30))
                    )
                    .shadow(
                        color: isEnabled ? Theme.Colors.focusAccent.opacity(0.40) : .clear,
                        radius: 16, x: 0, y: 6
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

// MARK: - Google G mark (4 colores oficiales + barra)

/// Aproximación de la "G" multicolor de Google en SwiftUI puro.
/// Ring de 4 cuadrantes (azul, rojo, amarillo, verde) + barra horizontal azul
/// que sale del centro hacia la derecha (la barra clásica de la G).
/// No es 1:1 con el logo oficial — es un placeholder limpio para el botón
/// "Continuar con Google" hasta que se integre OAuth real.
private struct GoogleGMark: View {
    var size: CGFloat = 18

    private static let blue   = Color(red: 66/255,  green: 133/255, blue: 244/255)
    private static let red    = Color(red: 234/255, green: 67/255,  blue: 53/255)
    private static let yellow = Color(red: 251/255, green: 188/255, blue: 4/255)
    private static let green  = Color(red: 52/255,  green: 168/255, blue: 83/255)

    var body: some View {
        Canvas { ctx, sz in
            let s = min(sz.width, sz.height)
            let center = CGPoint(x: sz.width / 2, y: sz.height / 2)
            let outerR = s * 0.48
            let thickness = s * 0.21
            let innerR = outerR - thickness

            func arc(start: Double, end: Double, color: Color) {
                var p = Path()
                p.addArc(center: center, radius: outerR,
                         startAngle: .degrees(start),
                         endAngle: .degrees(end),
                         clockwise: false)
                p.addArc(center: center, radius: innerR,
                         startAngle: .degrees(end),
                         endAngle: .degrees(start),
                         clockwise: true)
                p.closeSubpath()
                ctx.fill(p, with: .color(color))
            }

            // Ring: 4 cuadrantes con los colores de Google, en sentido horario
            // empezando desde top-left (12 a 3, 3 a 6, etc).
            arc(start: 180, end: 270, color: Self.blue)   // top-left
            arc(start: 270, end: 360, color: Self.red)    // top-right
            arc(start: 0,   end: 90,  color: Self.yellow) // bottom-right
            arc(start: 90,  end: 180, color: Self.green)  // bottom-left

            // Barra horizontal azul — el "crossbar" de la G, sale del centro
            // hacia la derecha cubriendo el cuadrante rojo-amarillo.
            let barWidth = outerR * 1.0
            let barHeight = thickness
            let barRect = CGRect(
                x: center.x - barHeight * 0.05,
                y: center.y - barHeight / 2,
                width: barWidth,
                height: barHeight
            )
            ctx.fill(
                Path(roundedRect: barRect, cornerSize: CGSize(width: 1.5, height: 1.5)),
                with: .color(Self.blue)
            )
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthStore())
}
