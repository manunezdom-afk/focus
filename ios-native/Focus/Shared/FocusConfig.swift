import Foundation

/// Configuración pública de Focus. NO contiene secretos.
///
/// - `supabaseURL`: documentado en AUTH_SESSION_AUDIT.md.
/// - `supabaseAnonKey`: JWT público. Es seguro tenerlo en el cliente (RLS controla
///   el acceso real). Si está vacío, la app permite modo demo pero NO puede
///   iniciar sesión real. Para obtenerlo: Supabase Dashboard → tu proyecto →
///   Settings → API → "Project API keys" → "anon public".
/// - `apiOrigin`: base URL del backend Vercel (donde viven /api/*).
///
/// SEGURIDAD: NUNCA pongas `service_role` acá. Eso vive server-side
/// en Vercel env vars (`SUPABASE_SERVICE_ROLE_KEY`).
enum FocusConfig {
    static let supabaseURL = URL(string: "https://hvwqeemtfoyvfmongwzo.supabase.co")!

    /// ⚠️ Pegá acá tu VITE_SUPABASE_ANON_KEY de Supabase Dashboard.
    /// Es un JWT que empieza con "eyJ...". Es público (anon, no service_role).
    /// Mientras esté vacío, login real falla con mensaje "Configuración faltante";
    /// modo demo funciona sin problema.
    static let supabaseAnonKey = ""

    static let apiOrigin = URL(string: "https://www.usefocus.me")!

    /// True si la auth real puede funcionar (anon key presente).
    static var isAuthConfigured: Bool {
        !supabaseAnonKey.isEmpty
    }
}
