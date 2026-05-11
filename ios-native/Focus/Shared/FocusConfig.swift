import Foundation

/// Configuración pública de Focus. NO contiene secretos.
///
/// - `supabaseURL`: URL del proyecto Supabase.
/// - `supabaseAnonKey`: clave pública del cliente (publishable). Es segura
///   en el binario — Supabase RLS controla el acceso real. NUNCA usar
///   `sb_secret_*` ni un JWT con `role: service_role` acá.
/// - `apiOrigin`: base URL del backend Vercel (donde viven /api/*).
///
/// **Formatos válidos para anon key**:
/// - `sb_publishable_*` (nuevo formato Supabase, late 2024+) — *este es el que usamos*.
/// - `eyJ...` (legacy JWT con `role: anon`) — sigue funcionando si lo prefieres.
///
/// **Cómo rotar la key**: Supabase Dashboard → Settings → API → "Publishable key".
/// Pegarla aquí y rebuild.
enum FocusConfig {
    static let supabaseURL = URL(string: "https://hvwqeemtfoyvfmongwzo.supabase.co")!

    /// Publishable key del proyecto Focus. Seguro en cliente — RLS protege los datos.
    /// Si la rotás, actualizá también `VITE_SUPABASE_ANON_KEY` en Vercel.
    static let supabaseAnonKey = "sb_publishable_uZZhxCyQPfb9K_4xawZV6g_FTUGEvhF"

    static let apiOrigin = URL(string: "https://www.usefocus.me")!

    /// True si la auth real puede funcionar (anon key presente).
    static var isAuthConfigured: Bool {
        !supabaseAnonKey.isEmpty
    }
}
