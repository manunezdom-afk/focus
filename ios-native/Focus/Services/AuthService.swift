import Foundation

// MARK: - Errors

enum AuthError: Error, LocalizedError {
    case configMissing
    case invalidEmail
    case rateLimited
    case emailNotConfigured
    case emailSendFailed
    case invalidCode
    case otpExpired
    case network(String)
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .configMissing:
            return "Auth no configurada. Falta el anon key de Supabase en FocusConfig.swift."
        case .invalidEmail:
            return "El correo no parece válido."
        case .rateLimited:
            return "Demasiados intentos. Espera un minuto antes de pedir otro código."
        case .emailNotConfigured:
            return "El servidor de envío de correos no está configurado todavía."
        case .emailSendFailed:
            return "No pudimos enviar el correo. Prueba de nuevo en un minuto."
        case .invalidCode:
            return "El código es incorrecto. Revísalo o pide uno nuevo."
        case .otpExpired:
            return "El código expiró. Pide uno nuevo."
        case .network(let msg):
            return "Error de red: \(msg)"
        case .unknown(let msg):
            return msg
        }
    }
}

// MARK: - Session model

/// Sesión de Supabase persistible (in-memory + Keychain).
struct SupabaseSession: Codable, Hashable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
    let userId: String
    let email: String

    var isExpired: Bool {
        expiresAt <= Date()
    }
}

// MARK: - Service

/// Capa HTTP para autenticación. Stateless.
/// - `sendOTP`: pega contra nuestro `/api/auth/email/send-otp` (Resend SMTP).
/// - `verifyOTP`: pega contra `<supabase>/auth/v1/verify` directamente.
enum AuthService {

    // MARK: - Network plumbing

    private static let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        cfg.waitsForConnectivity = false
        return URLSession(configuration: cfg)
    }()

    private static let decoder = JSONDecoder()
    private static let encoder = JSONEncoder()

    // MARK: - Send OTP

    private struct SendBody: Encodable { let email: String }

    /// Envía el código OTP al correo. No devuelve el código (se entrega por email).
    static func sendOTP(email: String) async throws {
        let clean = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard clean.contains("@"), clean.count > 3, clean.count <= 254 else {
            throw AuthError.invalidEmail
        }

        let url = FocusConfig.apiOrigin.appendingPathComponent("/api/auth/email/send-otp")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(SendBody(email: clean))

        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else {
                throw AuthError.unknown("Respuesta HTTP inválida")
            }
            switch http.statusCode {
            case 200:
                return
            case 400:
                let body = try? decoder.decode(ErrorBody.self, from: data)
                if body?.error == "invalid_email" {
                    throw AuthError.invalidEmail
                }
                throw AuthError.unknown("Solicitud inválida")
            case 429:
                throw AuthError.rateLimited
            case 503:
                let body = try? decoder.decode(ErrorBody.self, from: data)
                if body?.error == "email_not_configured" {
                    throw AuthError.emailNotConfigured
                }
                throw AuthError.unknown("Servicio no configurado")
            case 502:
                throw AuthError.emailSendFailed
            default:
                throw AuthError.unknown("HTTP \(http.statusCode)")
            }
        } catch let err as AuthError {
            throw err
        } catch let err as URLError {
            throw AuthError.network(err.localizedDescription)
        } catch {
            throw AuthError.network(error.localizedDescription)
        }
    }

    // MARK: - Verify OTP

    private struct VerifyBody: Encodable {
        let email: String
        let token: String
        let type: String
    }

    /// Verifica el código contra Supabase y devuelve la sesión completa.
    static func verifyOTP(email: String, token: String) async throws -> SupabaseSession {
        guard FocusConfig.isAuthConfigured else {
            throw AuthError.configMissing
        }

        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        // Supabase puede estar configurado en 6 u 8 dígitos — no truncamos.
        let cleanToken = token.filter(\.isNumber)
        guard cleanToken.count >= 6, cleanToken.count <= 10 else {
            throw AuthError.invalidCode
        }

        let url = FocusConfig.supabaseURL.appendingPathComponent("/auth/v1/verify")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(FocusConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(FocusConfig.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.httpBody = try encoder.encode(VerifyBody(email: cleanEmail, token: cleanToken, type: "email"))

        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else {
                throw AuthError.unknown("Respuesta HTTP inválida")
            }

            if (200..<300).contains(http.statusCode) {
                let r = try decoder.decode(VerifyResponse.self, from: data)
                let expiresAt = Date(timeIntervalSince1970: r.expires_at)
                return SupabaseSession(
                    accessToken: r.access_token,
                    refreshToken: r.refresh_token,
                    expiresAt: expiresAt,
                    userId: r.user.id,
                    email: r.user.email ?? cleanEmail
                )
            }

            // Errores de Supabase
            let body = try? decoder.decode(ErrorBody.self, from: data)
            let raw = body?.error_description ?? body?.msg ?? body?.error ?? ""
            let msg = raw.lowercased()

            if msg.contains("expired") {
                throw AuthError.otpExpired
            }
            if msg.contains("invalid") || msg.contains("incorrect") || msg.contains("token") {
                throw AuthError.invalidCode
            }
            if http.statusCode == 400 || http.statusCode == 401 || http.statusCode == 403 {
                throw AuthError.invalidCode
            }
            throw AuthError.unknown(raw.isEmpty ? "HTTP \(http.statusCode)" : raw)
        } catch let err as AuthError {
            throw err
        } catch let err as URLError {
            throw AuthError.network(err.localizedDescription)
        } catch {
            throw AuthError.network(error.localizedDescription)
        }
    }

    // MARK: - Sign out

    /// MVP: solo limpia local. Cuando agreguemos sync con backend, llamar
    /// `/auth/v1/logout` con el bearer para invalidar el refresh token server-side.
    static func signOut() {
        KeychainStore.clearAllAuth()
    }
}

// MARK: - Wire types (privados al servicio)

private struct VerifyResponse: Decodable {
    let access_token: String
    let refresh_token: String
    let expires_at: Double
    let user: SBUser

    struct SBUser: Decodable {
        let id: String
        let email: String?
    }
}

private struct ErrorBody: Decodable {
    let error: String?
    let error_description: String?
    let msg: String?
    let code: String?
}
