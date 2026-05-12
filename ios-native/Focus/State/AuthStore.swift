import SwiftUI
import Foundation
import AuthenticationServices

/// Estado actual de la autenticación.
enum AuthState: Equatable {
    case loading                    // Resolviendo Keychain (instantáneo en práctica)
    case loggedOut                  // Sin sesión, sin demo
    case codeSent(email: String)    // Email enviado, esperando código
    case loggedIn(SupabaseSession)  // Sesión activa
    case demo                       // Modo demo (sin login real)
}

/// Store de autenticación. Se inyecta como `@EnvironmentObject` y reacciona
/// a cambios de `state`.
@MainActor
final class AuthStore: ObservableObject {
    @Published var state: AuthState = .loading
    @Published var lastError: String? = nil
    @Published var isWorking: Bool = false

    private let expiresAtKey = "focus.v1.auth.expiresAt"

    init() {
        if let session = loadPersistedSession() {
            if !session.isExpired {
                // Sesión válida — entrar directo.
                state = .loggedIn(session)
            } else if !session.refreshToken.isEmpty {
                // Access token expirado pero hay refresh token: arrancar en
                // loading y disparar refresh asíncrono. Si funciona, la sesión
                // se renueva sin que el usuario vea Login.
                state = .loading
                Task { [weak self] in
                    await self?.attemptRefresh(using: session)
                }
            } else {
                // Hay datos pero sin refresh — limpio y a Login.
                KeychainStore.clearAllAuth()
                state = .loggedOut
            }
        } else {
            state = .loggedOut
        }
    }

    // MARK: - Refresh

    /// Intenta renovar la sesión con el refresh token persistido. Solo se
    /// llama desde `init()` cuando la sesión está expirada. Si falla, limpia
    /// los tokens locales y manda al usuario a Login con un mensaje claro.
    /// **No toca datos locales** (eventos/tareas/etc) — solo limpia auth.
    private func attemptRefresh(using expired: SupabaseSession) async {
        do {
            let renewed = try await AuthService.refreshSession(refreshToken: expired.refreshToken)
            // Si Supabase no devolvió user (algunas configs no incluyen),
            // reutilizamos el userId/email del persistido.
            let merged = SupabaseSession(
                accessToken: renewed.accessToken,
                refreshToken: renewed.refreshToken,
                expiresAt: renewed.expiresAt,
                userId: renewed.userId.isEmpty ? expired.userId : renewed.userId,
                email: renewed.email.isEmpty ? expired.email : renewed.email
            )
            persistSession(merged)
            state = .loggedIn(merged)
        } catch {
            // Refresh falló — limpiamos auth pero NO datos locales.
            KeychainStore.clearAllAuth()
            UserDefaults.standard.removeObject(forKey: expiresAtKey)
            lastError = "Tu sesión expiró. Vuelve a iniciar sesión."
            state = .loggedOut
        }
    }

    // MARK: - Computed

    var isLoggedIn: Bool {
        if case .loggedIn = state { return true }
        return false
    }

    var isDemo: Bool {
        if case .demo = state { return true }
        return false
    }

    var isAuthenticatedOrDemo: Bool {
        isLoggedIn || isDemo
    }

    var currentEmail: String? {
        if case .loggedIn(let s) = state { return s.email }
        return nil
    }

    var accessToken: String? {
        if case .loggedIn(let s) = state { return s.accessToken }
        return nil
    }

    // MARK: - Actions

    /// Pide código OTP al servidor.
    func sendOTP(email: String) async {
        lastError = nil
        isWorking = true
        defer { isWorking = false }
        do {
            try await AuthService.sendOTP(email: email)
            let clean = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            state = .codeSent(email: clean)
            HapticManager.shared.success()
        } catch let err as AuthError {
            lastError = err.errorDescription
            HapticManager.shared.warning()
        } catch {
            lastError = error.localizedDescription
            HapticManager.shared.warning()
        }
    }

    /// Verifica el código y crea sesión.
    func verifyOTP(token: String) async {
        guard case .codeSent(let email) = state else { return }
        lastError = nil
        isWorking = true
        defer { isWorking = false }
        do {
            let session = try await AuthService.verifyOTP(email: email, token: token)
            persistSession(session)
            state = .loggedIn(session)
            HapticManager.shared.success()
        } catch let err as AuthError {
            lastError = err.errorDescription
            HapticManager.shared.warning()
        } catch {
            lastError = error.localizedDescription
            HapticManager.shared.warning()
        }
    }

    /// Vuelve al paso "ingresar email".
    func changeEmail() {
        lastError = nil
        state = .loggedOut
    }

    /// Pide otro código (re-send) sin volver al paso anterior.
    func resendCode() async {
        guard case .codeSent(let email) = state else { return }
        await sendOTP(email: email)
        // sendOTP setea state = .codeSent(email) de nuevo, lo que es correcto.
    }

    /// Inicia el flujo OAuth de Google. Lanza `ASWebAuthenticationSession`
    /// (Safari in-app), espera el callback `focus://auth-callback#…tokens…`,
    /// y persiste la sesión igual que el OTP path.
    ///
    /// **Status**: deprecated en favor de `signInWithGoogleNative()`.
    /// Lo dejamos para fallback temporal si el SDK nativo falla en
    /// runtime. Cuando confirmemos que el native flow es estable post-beta,
    /// se puede eliminar. iOS muestra "hvwqeemt..." en el prompt — por eso
    /// `LoginView.isGoogleSignInEnabled` controla qué flow ejecutar.
    ///
    /// `anchor` lo provee la vista (LoginView) — sin anchor válido la
    /// presentación falla en iOS 13+.
    func signInWithGoogle(presentationAnchor: ASPresentationAnchor) async {
        lastError = nil
        isWorking = true
        defer { isWorking = false }
        do {
            let session = try await AuthService.signInWithGoogle(
                presentationAnchor: presentationAnchor
            )
            persistSession(session)
            state = .loggedIn(session)
            HapticManager.shared.success()
        } catch AuthError.oauthCanceled {
            // El usuario cerró el Safari sheet — silencioso, no mostramos
            // banner agresivo. El estado se mantiene como está (.loggedOut).
        } catch let err as AuthError {
            lastError = err.errorDescription
            HapticManager.shared.warning()
        } catch {
            lastError = error.localizedDescription
            HapticManager.shared.warning()
        }
    }

    /// Inicia el flow nativo de Google Sign-In via el SDK GoogleSignIn-iOS.
    /// Genera nonce, lanza la UI nativa de Google, obtiene `idToken`, lo
    /// intercambia con Supabase por una sesión. iOS NO muestra el host de
    /// Supabase — solo la pantalla oficial de Google.
    ///
    /// Requiere el package `GoogleSignIn-iOS` agregado al target (paso
    /// manual via Xcode). Sin SPM, el método throws error claro.
    ///
    /// `presenter` es el `UIViewController` activo. La vista lo resuelve
    /// con `resolveTopViewController()` igual que como hace el OAuth web.
    @MainActor
    func signInWithGoogleNative(presenter: UIViewController) async {
        lastError = nil
        isWorking = true
        defer { isWorking = false }
        do {
            let session = try await AuthService.signInWithGoogleNative(
                presenter: presenter
            )
            persistSession(session)
            state = .loggedIn(session)
            HapticManager.shared.success()
        } catch AuthError.oauthCanceled {
            // Usuario tocó cancelar en la UI de Google — silencioso.
        } catch let err as AuthError {
            lastError = err.errorDescription
            HapticManager.shared.warning()
        } catch {
            lastError = error.localizedDescription
            HapticManager.shared.warning()
        }
    }

    /// Entra en modo demo (sin login).
    func enterDemo() {
        lastError = nil
        state = .demo
        HapticManager.shared.tap()
    }

    /// Cierra sesión.
    /// NO borra datos locales (FocusDataStore) — eso queda en Ajustes
    /// como acción manual del usuario.
    func signOut() {
        AuthService.signOut()
        // También limpia la sesión local de Google SDK (si el package
        // está instalado). Sin esto, GIDSignIn.sharedInstance.currentUser
        // queda con el usuario anterior y el próximo signIn podría
        // auto-completar sin selector. No afecta a Supabase ni Keychain.
        AuthService.signOutGoogleNative()
        UserDefaults.standard.removeObject(forKey: expiresAtKey)
        lastError = nil
        state = .loggedOut
        HapticManager.shared.tick()
    }

    /// Sale de modo demo y vuelve a LoginView.
    func exitDemo() {
        lastError = nil
        state = .loggedOut
        HapticManager.shared.tick()
    }

    // MARK: - Persistencia

    private func loadPersistedSession() -> SupabaseSession? {
        guard let access = KeychainStore.get(.accessToken),
              let refresh = KeychainStore.get(.refreshToken),
              let userId = KeychainStore.get(.userId),
              let email = KeychainStore.get(.email),
              let expiresAt = UserDefaults.standard.object(forKey: expiresAtKey) as? Date else {
            return nil
        }
        return SupabaseSession(
            accessToken: access,
            refreshToken: refresh,
            expiresAt: expiresAt,
            userId: userId,
            email: email
        )
    }

    private func persistSession(_ s: SupabaseSession) {
        KeychainStore.set(s.accessToken, forKey: .accessToken)
        KeychainStore.set(s.refreshToken, forKey: .refreshToken)
        KeychainStore.set(s.userId, forKey: .userId)
        KeychainStore.set(s.email, forKey: .email)
        UserDefaults.standard.set(s.expiresAt, forKey: expiresAtKey)
    }
}
