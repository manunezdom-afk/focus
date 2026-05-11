import Foundation

/// Capa de persistencia local en `UserDefaults`.
///
/// Reglas:
/// - **Solo datos no-sensibles.** Tokens, secrets y material auth van a Keychain (no acá).
/// - **Keys versionadas** con prefix `focus.v1.` para permitir migración futura (v2, v3…)
///   sin colisiones.
/// - **Encoding JSON ISO-8601** para fechas — compatible con backend si más adelante
///   sincronizamos contra Supabase.
/// - **Errores silenciosos**: load devuelve `nil`, save imprime a consola. La app sigue
///   funcionando con fallback a demo data. Un decode roto no rompe el boot.
enum FocusLocalStore {

    /// Claves persistidas. Cualquier dato nuevo a persistir agregar acá con prefix versionado.
    enum Key: String, CaseIterable {
        case tasks         = "focus.v1.tasks"
        case events        = "focus.v1.events"
        case suggestions   = "focus.v1.suggestions"
        case novaMessages  = "focus.v1.novaMessages"
        case settings      = "focus.v1.settings"
    }

    // MARK: - Encoders cacheados (mismo motivo que DateFormatters)

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    private static var defaults: UserDefaults { .standard }

    // MARK: - API

    /// Codifica y guarda un valor bajo la key indicada.
    /// Si falla, imprime el error a consola y la key queda con su valor previo.
    static func save<T: Encodable>(_ value: T, forKey key: Key) {
        do {
            let data = try encoder.encode(value)
            defaults.set(data, forKey: key.rawValue)
        } catch {
            print("[FocusLocalStore] save '\(key.rawValue)' failed: \(error)")
        }
    }

    /// Carga y decodifica un valor de la key indicada.
    /// Devuelve `nil` si la key no existe, está corrupta, o el tipo no matchea.
    static func load<T: Decodable>(_ type: T.Type, forKey key: Key) -> T? {
        guard let data = defaults.data(forKey: key.rawValue) else { return nil }
        do {
            return try decoder.decode(type, from: data)
        } catch {
            print("[FocusLocalStore] load '\(key.rawValue)' failed: \(error)")
            return nil
        }
    }

    /// Elimina una key específica.
    static func clear(_ key: Key) {
        defaults.removeObject(forKey: key.rawValue)
    }

    /// Elimina TODAS las keys gestionadas por este store.
    /// Útil para "Borrar datos locales" o futuro logout.
    /// NOTA: no toca Keychain (este store no lo usa) ni otras keys de UserDefaults
    /// que la app/SDKs externos pudieran tener.
    static func clearAll() {
        for key in Key.allCases {
            defaults.removeObject(forKey: key.rawValue)
        }
    }
}
