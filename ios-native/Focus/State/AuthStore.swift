import SwiftUI
import Foundation

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
        if let session = loadPersistedSession(), !session.isExpired {
            state = .loggedIn(session)
        } else {
            if loadPersistedSession() != nil {
                // Había sesión pero está expirada → limpiar
                KeychainStore.clearAllAuth()
            }
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
