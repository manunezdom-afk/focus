# Auth & sesión — auditoría

Estado del sistema de cuenta, login y sesión de Focus después del punto 5
del plan. Owner: Martín. Última revisión: 2026-05-07.

---

## 1. Métodos de login disponibles

| Método | Estado | Dónde | Notas |
| --- | --- | --- | --- |
| **OTP por email** | ✅ Activo (principal) | `signInWithEmail` + `verifyOtp` en AuthContext | Backend custom: `/api/auth/email/send-otp` con Resend (no usa SMTP de Supabase por su rate-limit chico). |
| **Email + contraseña (signin)** | ✅ Activo | `signInWithPassword` | Login clásico. |
| **Email + contraseña (signup)** | ✅ Activo | `signUpWithPassword` | Crea cuenta. Mínimo 8 chars (más estricto que el default 6 de Supabase). |
| **Recuperar contraseña** | ✅ Activo | `resetPasswordForEmail` + `updatePassword` | Flow PASSWORD_RECOVERY de Supabase. |
| **Google OAuth** | ✅ Activo | `signInWithGoogle` | Web: redirect estándar. iOS Capacitor: `Browser.open()` + deep link `me.usefocus.app://login-callback`. |
| Magic link legacy | ❌ Removido | — | Reemplazado por OTP custom. |
| **Modo "demo"** (implícito) | ✅ Activo | App.jsx renderiza sin user | La app se puede explorar sin login; cualquier feature que necesite cuenta (Nova, push) responde con 401 / "Inicia sesión". No hay seed de datos demo. |

---

## 2. Flujo actual de sesión

```
                            ┌───────────────────────────┐
                            │      App arranca          │
                            └────────────┬──────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────┐
                  │ AuthContext mount:                   │
                  │  loading=true                        │
                  │  supabase.auth.getSession() pending  │
                  │  + onAuthStateChange listener        │
                  └────────────┬─────────────────────────┘
                               │
                               ▼
                  ┌──────────────────────────────────────┐
                  │ BootSplash visible                   │
                  │   (mín 700ms, máx 4s,                │
                  │    espera a authLoading=false)       │
                  └────────────┬─────────────────────────┘
                               │
                               ▼
        ┌──────────────────────┴──────────────────────┐
        │                                             │
   user != null                                  user == null
        │                                             │
        ▼                                             ▼
┌──────────────────┐                  ┌──────────────────────────┐
│ App principal    │                  │ App principal            │
│ Datos del user   │                  │ ("modo demo implícito"). │
│ Nova autenticada │                  │ Click "Iniciar sesión"   │
│ Push activable   │                  │ → AuthModal              │
└──────────────────┘                  └──────────────────────────┘
```

### Eventos de Supabase manejados

| Evento | Acción |
| --- | --- |
| `SIGNED_IN` | Setear user, sync queue offline, fetchBehavior, flush push subscription pendiente |
| `SIGNED_OUT` | Setear user=null, **limpiar datos privados locales** (canónico vía `clearPrivateUserDataLocal`) |
| `PASSWORD_RECOVERY` | Marcar `recoveryMode=true`, abrir modal en paso "nueva contraseña" |
| `TOKEN_REFRESHED` | Implícito (no hace falta acción extra) |
| `USER_UPDATED` | Implícito |

---

## 3. Cómo se protege la app

**Hoy:** la app permite explorar sin login (modo demo implícito). Los
endpoints que cuestan plata o tocan datos privados rechazan con 401:
- `/api/focus-assistant`, `/api/analyze-photo` — auth obligatoria desde el
  punto 1 (auditoría de seguridad).
- `/api/auth/delete-account`, `/api/push`, `/api/calendar-feeds`, etc. —
  todos exigen Bearer válido.

**RLS Supabase:** todas las tablas con datos del usuario tienen Row Level
Security. Sin sesión, el cliente no puede leer ni escribir.

**Datos cacheados en localStorage**: clave por usuario
(`focus_events_<userId>`). Cuando el user cambia o cierra sesión, el helper
`clearPrivateUserDataLocal` los borra.

**Flash prevention:** el BootSplash se mantiene hasta que `authLoading=false`
(con cap defensivo de 4s). Esto evita que el usuario vea "Mi Día" vacío
durante el split-second en que Supabase hidrata el JWT persistido.

---

## 4. OTP por email

Flujo:
1. Cliente llama `signInWithEmail(email)`.
2. AuthContext sanitiza `email.trim().toLowerCase()` y POSTs a
   `/api/auth/email/send-otp`.
3. Backend (`api/auth/email/send-otp.js`):
   - Rate limit por IP.
   - Valida formato.
   - Llama `admin.auth.admin.generateLink({ type: 'email', email, options: { ... } })`
     que retorna el OTP.
   - Envía el código vía Resend.
4. Usuario recibe el email con código de 6 dígitos.
5. Cliente llama `verifyOtp(email, token)`.
6. AuthContext sanitiza el token (solo dígitos, max 10), llama
   `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
7. Supabase crea sesión PKCE → `onAuthStateChange('SIGNED_IN')`.
8. Cliente entra a la app.

**Robustez:**
- Cooldown de 60s (alineado con el rate-limit de Supabase).
- Cooldown de 5 min al detectar rate-limit del backend.
- `sessionStorage focus_auth_pending` para sobrevivir reload.
- TTL de 15 min en sessionStorage (después el OTP ya expiró en Supabase).
- Doble submit prevenido por `submitting` state.
- Errores humanizados vía `humanizeAuthError` (no se filtra texto crudo).
- **Logs sanitizados** (punto 4 privacidad): no se registra el email en
  logs de error de `send-otp.js`.

---

## 5. Estado de Google OAuth

**Web (PWA, browser):**
```js
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin },
})
```
Funciona estándar — Supabase redirige al provider, vuelve al origin con
fragment de PKCE, `detectSessionInUrl: true` lo procesa.

**iOS Capacitor:**
```js
const { data } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'me.usefocus.app://login-callback',
    skipBrowserRedirect: true,
  },
})
const { Browser } = await import('@capacitor/browser')
await Browser.open({ url: data.url, presentationStyle: 'popover' })
```
Y el listener `appUrlOpen` en AuthContext hace
`exchangeCodeForSession(url)` y cierra el `Browser` con `Browser.close()`.

**Configuración actual en Supabase Dashboard** (verificada 2026-05-07 vía Computer Use, con
correcciones aplicadas):
- **Site URL**: `https://www.usefocus.me` (canonical productivo) ✅
- **Redirect URLs configuradas** (11 total, las relevantes para Focus):
  - `https://usefocus.me/**` ✓ cubre `?confirmed=1`, `?recovery=1` (sin www)
  - `https://www.usefocus.me/**` ✓ canonical productivo (con www) — agregada el 2026-05-07
  - `me.usefocus.app://login-callback` ✓ deep link iOS
  - `http://localhost:3000/**` ✓ dev local
  - 7 entries de otros proyectos (kairos, sparkstudio) — ignoradas para Focus,
    se pueden limpiar a futuro pero no afectan.

**Configuración requerida en Google Cloud Console** (OAuth client):
- **Authorized redirect URIs**: `https://<supabase-project>.supabase.co/auth/v1/callback`
- (Supabase es quien recibe el callback de Google y luego redirige al
  Site URL / Redirect URL configurada arriba.)

**Configuración en Supabase → Authentication → Providers → Google:**
- Enabled: ✓
- Client ID: del Google Cloud Console
- Client Secret: del Google Cloud Console

---

## 6. Configuración requerida en Vercel

Variables de entorno (todas backend, ningún `VITE_` privado):

**Públicas (frontend, OK con `VITE_`):**
- `VITE_SUPABASE_URL` — URL pública del proyecto Supabase
- `VITE_SUPABASE_ANON_KEY` — anon key pública

**Privadas (backend only, sin `VITE_`):**
- `SUPABASE_URL` — duplicado para handlers serverless (lee `process.env`)
- `SUPABASE_SERVICE_ROLE_KEY` — admin de Supabase
- `ANTHROPIC_API_KEY` — Claude
- `RESEND_API_KEY`, `EMAIL_FROM` — envío de OTPs
- `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`,
  `APNS_ENV` — push iOS
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — Web Push
- `CRON_SECRET` — auth de cron-notifications

**Eliminadas:** `OPENAI_API_KEY` (legacy de TTS removido en `e4de579`).

---

## 7. Comportamiento iOS / Capacitor

**Cold start:**
1. iOS muestra el splash nativo (~800ms, `capacitor.config.json`).
2. WebView monta `index.html` con splash inline (mismo layout).
3. React monta y BootSplash continúa la imagen sin salto.
4. AuthContext arranca: `getSession()` lee del storage seguro de Capacitor.
5. Cuando `loading=false`, BootSplash se desvanece y se ve la app real.

**Background → foreground:**
- WebView se mantiene viva, no hay re-mount.
- Supabase auto-refresca tokens en background.
- No deberíamos ver flash; el state React es estable.

**Reset/cold start después de tiempo largo:**
- Refresh token TTL de Supabase (default 1 semana, configurable).
- Si caducó: `getSession()` devuelve null, listener emite `SIGNED_OUT`,
  user=null, datos privados se limpian, app queda en "modo demo".

**Storage Capacitor:**
- Supabase usa `localStorage` con `storageKey: 'focus-auth'`. En Capacitor
  WebView, localStorage persiste entre sesiones (es Cordova/WKWebView
  storage, no se borra al cerrar la app).

---

## 8. Logout

Pasos en `signOut()` (AuthContext):
1. `supabase.auth.signOut()` — invalida JWT del lado del servidor.
2. `setUser(null)` + `setSignalsUserId(null)`.
3. `clearPrivateUserDataLocal()` (helper canónico de
   [src/lib/privacyCleanup.js](src/lib/privacyCleanup.js)):
   - localStorage privado del usuario (eventos, tareas, perfil, memorias,
     suggestions, behavior, queue offline, signals, push pending).
   - sessionStorage (nova_history, OTP pending, device pairing, aurora
     continuity).
   - **NO** borra flags UX (welcome, hints, app_prefs) — son del
     dispositivo, no del usuario; borrarlas haría que el mismo user
     vuelva a ver onboarding al volver.

**Cross-tab:** si el user cierra sesión en otra pestaña, el listener
`onAuthStateChange('SIGNED_OUT')` también dispara `clearPrivateUserDataLocal`
en esta pestaña — los datos no quedan colgados.

---

## 9. Eliminación de cuenta

Endpoint `POST /api/auth/delete-account` con Bearer + `{ confirm: 'DELETE' }`:
1. Validar JWT.
2. Rate limit (5/min/IP).
3. `admin.auth.admin.deleteUser(userId, true)` → CASCADE en todas las
   tablas (lista en `delete-account.js`).
4. Cliente recibe 200 → llama `signOut()` + `clearAllUserDataLocal()`
   (que también borra flags UX).

Tablas que se borran (CASCADE FK):
`user_profiles, events, tasks, blocks, suggestions, user_memories,
notif_log, user_signals, user_behavior, push_subscriptions,
native_push_tokens, sent_notifications, calendar_feeds,
notification_deliveries, ai_usage, ai_usage_events, user_plans,
kairos_links, device_pairings`.

---

## 10. Bugs corregidos en este punto

| # | Bug | Fix |
| --- | --- | --- |
| 1 | BootSplash de duración fija (700ms) podía ocultarse antes de que `authLoading=false` → flash de "app sin sesión" en cold start lento de iPhone. | `useBootSplash(authLoading)` ahora espera al menos 700ms Y a que auth termine, con cap defensivo de 4s si Supabase se cuelga. |
| 2 | `SIGNED_OUT` cross-tab no limpiaba datos privados — si el user cerraba sesión en otra pestaña, esta seguía con eventos/tareas en localStorage. | Listener `onAuthStateChange('SIGNED_OUT')` llama a `clearPrivateUserDataLocal()` en cualquier caso. |
| 3 | Logs de `send-otp.js` filtraban email del usuario en errores de Resend. | Sanitizado en punto 4 — solo se loggea `error.code/name`. |

---

## 11. Pruebas realizadas

**Unit tests** (todas pasan):
- `tests/auth-errors.test.js` (23) — `humanizeAuthError`, `isValidEmail`,
  `passwordStrength`, `extractRetryAfterSec`, `isRateLimitError`,
  `isAcceptablePassword`. Verifica que NO se filtre texto crudo del error
  de Supabase al usuario.
- `tests/privacy-cleanup.test.js` (8) — limpieza local logout vs
  delete-account.
- `tests/auth-required.test.js` (5) — endpoints rechazan sin Bearer.
- Suite completa: 82/82 ok.

```bash
node --test tests/auth-errors.test.js tests/privacy-cleanup.test.js \
            tests/auth-required.test.js tests/usage-limits.test.js \
            tests/ai-pricing.test.js tests/security.test.js \
            tests/cron-config.test.js tests/apns.test.js
```

**Build:** `npm run build` ok (2.45s, sin warnings).

**Pruebas manuales** (a hacer desde Xcode con un dispositivo o simulador):

| # | Caso | Esperado |
| --- | --- | --- |
| 1 | Abrir app sin sesión | BootSplash → app principal sin datos del user |
| 2 | Click "Iniciar sesión" → email → recibir OTP → ingresar | Sesión creada, user en memoria |
| 3 | Recargar la app | Sesión persiste, datos del user cargan |
| 4 | Cerrar app y volver a abrir | Igual que #3 |
| 5 | Background → foreground | Sesión persiste, sin pantalla blanca |
| 6 | Mandar mensaje a Nova | Respuesta normal, contador `nova_message` +1 |
| 7 | Logout | Vuelve a "modo demo implícito", datos del user se borraron |
| 8 | Reabrir después de logout | NO aparece nada del user anterior |
| 9 | Otra pestaña: login → primera pestaña detecta SIGNED_IN | (web only) |
| 10 | Otra pestaña: logout → primera pestaña limpia datos | (web only) |

---

## 12. Pendientes antes de TestFlight / App Store

**Configuración externa pendiente** (Martín, verificada el 2026-05-07):

### Supabase Dashboard
- [x] Authentication → URL Configuration → Site URL: `https://www.usefocus.me` ✓ (canonical, actualizado 2026-05-07).
- [x] Redirect URLs incluye `https://usefocus.me/**`, `https://www.usefocus.me/**` y `me.usefocus.app://login-callback`. ✓
- [x] Provider Google habilitado con Client ID + Secret. Callback URL es
  `https://hvwqeemtfoyvfmongwzo.supabase.co/auth/v1/callback`. ✓
- [x] "Allow anonymous sign-ins": **OFF** ✓ (apagado el 2026-05-07 — la app no lo usa).
- [ ] (Opcional) Limpiar las 7 URLs de otros proyectos (kairos, sparkstudio) — no afectan, solo ruido.

### Google Cloud Console
- [ ] Verificar (sin acceso desde aquí) que el OAuth client tiene como
  **Authorized redirect URI**:
  `https://hvwqeemtfoyvfmongwzo.supabase.co/auth/v1/callback`
- Si falta esa entrada, el flow de Google fallaría con `redirect_uri_mismatch`.

### Vercel (APNs)
- [ ] Variables APNs configuradas para push iOS production:
  `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`,
  `APNS_ENV=production`.

### OpenAI Platform
- [ ] Rotar/desactivar `OPENAI_API_KEY` legacy (heredado de TTS removido en
  commit `e4de579`). La key fue eliminada de Vercel pero sigue activa en el
  dashboard de OpenAI. Sin acceso desde aquí.
  Acción exacta para Martín:
  1. Ir a `https://platform.openai.com/api-keys`.
  2. Identificar la key con label/uso reciente "Focus" (creada antes de la
     auditoría de seguridad).
  3. Pulsar "Delete" o "Revoke".

**Mejoras opcionales no bloqueantes:**
- Implementar exportación de datos in-app (cumplir GDPR). Queries listas en
  [PRIVACY_AUDIT.md](PRIVACY_AUDIT.md) §7.
- Banner "Sesión expirada" cuando refresh token falla — hoy el user vuelve
  silenciosamente al "modo demo implícito" sin saber por qué desaparecieron
  sus datos.
- Detectar `iOS Safari < 14.5` y mostrar mensaje claro (Supabase OAuth
  requiere PKCE).
- Onboarding diferenciado: si user es nuevo → Welcome → Onboarding; si
  vuelve después de borrar la cuenta → empezar de cero (los flags UX
  ya se borraron en delete).

**Rotaciones de seguridad** (heredadas de auditorías anteriores):
- [ ] Programar rotación trimestral de `CRON_SECRET`.

---

## 13. Verificación externa — 2026-05-07

Snapshot de lo que fue verificado vía Computer Use en este punto del plan:

| Item | Estado | Notas |
| --- | --- | --- |
| Vercel: producción Ready con commit `c81c786` | ✅ | Deploy `focus-4h4wxahnl` Ready hace 3 min. |
| Supabase Site URL | ✅ | `https://www.usefocus.me` (canonical) — corregido el 2026-05-07. |
| Supabase Redirect URLs | ✅ | Agregada `https://www.usefocus.me/**`. Total 11 URLs. |
| Supabase: deep link iOS allowed | ✅ | `me.usefocus.app://login-callback`. |
| Supabase: Google Provider | ✅ | Enabled con Client ID + Secret. Callback OK. |
| Supabase: Anonymous sign-ins | ✅ | **OFF** — apagado el 2026-05-07. La app no lo usa. |
| Google Cloud Console | ⏸ | No verificado desde aquí (sin acceso). Confirmar redirect URI. |
| OpenAI Platform: OPENAI_API_KEY legacy | ⏸ | No verificado (sin acceso). Pasos manuales arriba. |
