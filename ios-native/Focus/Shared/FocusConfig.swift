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

    // QA TEMPORAL — apunta a Preview deploy con linkedReminders[] feature.
    // Antes de TestFlight: revertir a https://www.usefocus.me y bypass nil.
    static let apiOrigin = URL(string: "https://focus-i4tjn8i0s-manunezdom-9658s-projects.vercel.app")!

    /// Si no es nil, inyecta el header `x-vercel-protection-bypass` en
    /// CADA request a apiOrigin para saltar la SSO de Vercel Preview.
    /// SOLO debe estar set durante QA local; nil en builds productivas.
    static let vercelBypassToken: String? = "UWuosEhcgQ4MymOF2teT7v0T6OP1nmTN"

    /// True si la auth real puede funcionar (anon key presente).
    static var isAuthConfigured: Bool {
        !supabaseAnonKey.isEmpty
    }

    // MARK: - Google Sign-In (nativo iOS)

    /// OAuth Client ID de tipo **iOS** del proyecto Google Cloud
    /// `veo3-premium`. Creado vía Chrome MCP el 2026-05-12 (pase 56) con
    /// Bundle ID `me.usefocus.app` + Team ID `D8UM897B2T`. Va al Info.plist
    /// como `GIDClientID` Y configurado en Supabase Authentication →
    /// Providers → Google "Client IDs" allowlist (junto al Web client).
    /// Público: NO es secreto — el reversed scheme está en el binario
    /// igualmente.
    static let googleIOSClientID =
        "587696845191-f1fh55ukaaqtk7odfb8stntmeoqlglglub.apps.googleusercontent.com"

    /// URL scheme que Info.plist debe registrar como `CFBundleURLTypes`
    /// para que iOS rute el callback de Google al app. Es el iOS Client
    /// ID con orden invertido. Sin esto registrado en Xcode UI, el flow
    /// OAuth no completa.
    static let googleReversedClientID =
        "com.googleusercontent.apps.587696845191-f1fh55ukaaqtk7odfb8stntmeoqlglglub"
}
