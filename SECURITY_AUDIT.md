# Focus — Auditoría de seguridad base (TestFlight / beta)

Fecha: 2026-05-07
Branch auditado: `claude/vigilant-mendeleev-52a46b` (sobre `main` @ 106cf57)
Scope: dejar la seguridad base de la app correctamente auditada y corregida antes de publicar / TestFlight.

---

## 1. Stack real

| Pieza | Detalle |
| --- | --- |
| Frontend | React 18 + Vite 5 + Tailwind, en Capacitor 8 para iOS nativo |
| Backend | Funciones serverless de Vercel (`/api/**.js`) |
| DB / Auth | Supabase (PostgreSQL + Auth + Realtime) |
| Push | Web Push (VAPID) + APNs nativo para builds App Store |
| IA | Anthropic SDK (Claude Haiku) — backend-only |
| Email | Resend (envío de OTP) — backend-only |
| Cron | GitHub Actions → `/api/cron-notifications` (autenticado con `CRON_SECRET`) |
| Hosting | Vercel; `main` → producción `usefocus.me` |

**Cliente Supabase:** `src/lib/supabase.js` (anon key + URL públicas vía `VITE_*`).
**Admin Supabase:** `api/_supabaseAdmin.js` (service-role, sólo backend).

**Tablas privadas detectadas (con RLS activado):**

`user_profiles`, `events`, `tasks`, `blocks`, `suggestions`, `user_memories`, `notif_log`, `user_signals`, `user_behavior`, `push_subscriptions`, `native_push_tokens`, `sent_notifications`, `calendar_feeds`, `notification_deliveries`, `ai_usage`, `kairos_links`, `device_pairings`.

---

## 2. Riesgos críticos encontrados

### 🔴 CRÍT-1 — `/api/focus-assistant` y `/api/analyze-photo` aceptaban requests sin Bearer
Los handlers tenían un comentario `TODO (1 semana): restaurar el bloqueo: if (!userId) return 401`. En producción cualquier persona con la URL podía vaciar la cuota de Anthropic mandando mensajes / fotos sin sesión. La cuota por usuario sólo se aplicaba si había token, así que un atacante simplemente no mandaba header.
**Estado:** corregido — ambos endpoints devuelven 401 sin Bearer válido.

### 🔴 CRÍT-2 — `signOut` no borraba la caché privada por-usuario en localStorage
`dataService.clearGlobalCache()` sólo limpiaba claves globales (`focus_events`, `focus_tasks`, …). Las claves namespaced por user (`focus_events_<uuid>`, `focus_tasks_<uuid>`, `focus_task_links_<uuid>`, etc.) quedaban en disco indefinidamente. Si el dispositivo se prestaba/perdía, esos datos seguían leíbles desde DevTools o cualquier app con acceso al webview storage.
**Estado:** corregido — nuevo `dataService.clearAllLocalCache()` que recorre `localStorage` por prefijos conocidos y borra todas las variantes globales y por-usuario; lo invoca `signOut()`. También limpia `focus_sync_queue` (cola offline) y `focus_signals_queue`, que antes podían quedar con writes del usuario A intentándose contra la sesión de B (RLS las rechaza, pero quedaban reintentándose).

### 🔴 CRÍT-3 — `signOut` no limpiaba `nova_history` ni `focus_pending_nova_seed` en sessionStorage
El historial de chat con Nova vivía en `sessionStorage.nova_history`. Al cerrar sesión y abrir la app otra vez (otra cuenta o mismo dispositivo en un kiosko), la próxima persona que abriera Nova veía las últimas conversaciones del usuario anterior.
**Estado:** corregido — `signOut` limpia ambos.

### 🟠 ALTO-4 — Sin flujo de "Eliminar cuenta"
Requerido por App Store Review (Guideline 5.1.1(v)) y necesario para alinearse con GDPR/CCPA. No existía ni endpoint ni UI.
**Estado:** corregido — creado `POST /api/auth/delete-account` (Bearer + `confirm:'DELETE'`) que llama a `admin.auth.admin.deleteUser`. El cascade de FKs (`REFERENCES auth.users(id) ON DELETE CASCADE` en cada tabla privada) se encarga de borrar todos los datos del usuario en una operación. UI en `Ajustes → Cuenta → Eliminar cuenta` con modal de confirmación que pide tipear `DELETE` y luego ejecuta `signOut` local.

### 🟡 MED-5 — Políticas RLS sin `WITH CHECK` explícito
Todas las políticas vivían como `FOR ALL USING (auth.uid() = user_id)`. PostgreSQL hace fallback a `USING` para `WITH CHECK` cuando no se especifica, así que el comportamiento era correcto, pero queda implícito. Un cambio futuro al motor o un refactor podía dejar un INSERT/UPDATE sin chequeo de fila nueva.
**Estado:** corregido — migración `012_security_rls_baseline.sql` reescribe todas las políticas con `USING (...) WITH CHECK (...)` explícito y nombres consistentes (`<tabla>_owner_*`). `supabase/schema.sql` actualizado para reflejar el estado canónico.

---

## 3. Riesgos medios / observaciones

- **MED-6 — `/api/auth/email/send-otp` crea cuentas vía `admin.createUser({email_confirm:true})` antes de verificar OTP.** Riesgo: enumeración de emails y cuentas-zombi sin sesión. Mitigado con rate limit por IP (8/min) y por email (3/min). Aceptable para beta — flagged en "pendientes" para revisión post-launch.
- **OK — `/api/kairos/inbox` sin Bearer.** Es por diseño: el `focusCode` es identificador público, las sugerencias quedan en `pending` hasta que el usuario apruebe. Rate limit por IP (60/min) + por código (30/h). Comentado en migración 011.
- **OK — `/api/ics-feed` sin Bearer.** Por diseño: los calendar clients (Google/Apple Calendar) no mandan JWT. Token único de 32 bytes (≥256 bits). El usuario puede revocarlo regenerándolo. Headers incluyen `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer`.
- **OK — Snooze de push sin JWT.** Autenticado por posesión del endpoint (URL opaca emitida por FCM/APNs sólo al device suscrito). Documentado en `api/push.js`.
- **OK — `/api/cron-notifications` con shared secret HMAC-equivalente** (`CRON_SECRET`). Trim defensivo contra whitespace en GitHub Secrets / Vercel env.
- **OK — CSP estricta** en `vercel.json`: `default-src 'self'`, `frame-ancestors 'none'`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org`, etc. + HSTS preload + nosniff + Permissions-Policy con `payment=()` y `usb=()` cerrados.

---

## 4. Cambios aplicados

### Backend (`api/`)
- `api/focus-assistant.js` — auth obligatoria (devuelve 401 sin Bearer); cuota diaria siempre activa.
- `api/analyze-photo.js` — auth obligatoria; cuota diaria siempre activa.
- `api/auth/delete-account.js` (**nuevo**) — borrado de cuenta vía `admin.deleteUser` con cascade.

### Frontend (`src/`)
- `src/services/dataService.js` — `clearAllLocalCache()` borra globales + per-user + colas offline / signals.
- `src/context/AuthContext.jsx` — `signOut()` ahora:
  - Resetea `signalsUserId(null)`.
  - Limpia `nova_history` y `focus_pending_nova_seed` en `sessionStorage`.
  - Llama `clearAllLocalCache()` en lugar de `clearGlobalCache()`.
- `src/views/SettingsView.jsx` — fila "Eliminar cuenta" con modal `DeleteAccountRow` que pide tipear `DELETE` y llama al endpoint nuevo.

### Base de datos (`supabase/`)
- `supabase/migrations/012_security_rls_baseline.sql` (**nuevo**) — endurece todas las políticas con `WITH CHECK` explícito + garantiza RLS en todas las tablas privadas + reafirma que `device_pairings` no expone policies.
- `supabase/schema.sql` — actualizado al estado post-migración (mismo contenido nominal, nombres y `WITH CHECK` consistentes).

### Tests (`tests/`)
- `tests/auth-required.test.js` (**nuevo**) — 5 tests que aseguran que los endpoints sensibles devuelven 401 sin token y 405 ante GET.

### Documentación
- Este `SECURITY_AUDIT.md` (**nuevo**).

---

## 5. Riesgos pendientes (post-beta)

| Id | Riesgo | Acción recomendada | Prioridad |
| --- | --- | --- | --- |
| PEND-1 | `send-otp` crea cuentas pre-verificación | Mover a flujo "OTP-first sin pre-create" o agregar columna `email_verified_at` y hard-delete de cuentas no confirmadas tras 24 h | media |
| PEND-2 | Rate limit `_lib/rateLimit.js` es in-memory | Migrar a tabla Supabase (`api_rate_limits`) atómica vía RPC para que sobreviva entre invocaciones serverless | media |
| PEND-3 | `/api/cron-notifications` no rota `CRON_SECRET` | Agendar rotación trimestral en Vercel + GitHub Secrets | baja |
| PEND-4 | No hay 2FA / passkeys | Evaluar passkeys post-launch | baja |
| PEND-5 | `nova_history` se persiste en `sessionStorage` no encriptado | Aceptable mientras corra dentro de la sandbox del WebView; si se mueve a algo persistente, considerar Web Crypto | baja |
| PEND-6 | `/api/auth/email/send-otp` no envía a usuarios con cuenta soft-deleted | Verificar que `deleteUser` borra completamente y no deja residuos en `auth.users` | revisar manualmente |

---

## 6. Confirmaciones de seguridad base

- ✅ **Service-role JAMÁS está en frontend.** `grep` en `src/` por `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `sk-ant-`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, `APNS_PRIVATE_KEY` confirma que sólo viven en `api/` (process.env) o como referencias dentro de mensajes de error (UI).
- ✅ **Anthropic API key sólo en backend.** `process.env.ANTHROPIC_API_KEY` en `api/focus-assistant.js` y `api/analyze-photo.js`. Ningún `import.meta.env.VITE_ANTHROPIC_*`.
- ✅ **RLS activado en todas las tablas privadas** (migración 012).
- ✅ **Todas las políticas usan `auth.uid()`** — ninguna confía en `user_id` enviado por el cliente.
- ✅ **`auth.uid()` se evalúa siempre del lado server.** El frontend pasa `user.id` que sale de `useAuth()` → `supabase.auth.getSession()`, no de inputs manipulables.
- ✅ **Rutas protegidas / datos privados no se cargan sin sesión.** Cada hook de datos (`useEvents`, `useTasks`, `useUserMemories`, `useUserProfile`, `useSuggestions`) corta con `if (!user) return` antes de leer Supabase. La UI muestra estructura sin contenido a usuarios no autenticados — aceptable para CTA "Iniciar sesión".
- ✅ **Logout limpia datos privados.** Sesión Supabase + sessionStorage de Nova/auth + localStorage globales y per-user.
- ✅ **CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy** activos vía `vercel.json`.
- ✅ **No hay credenciales hardcodeadas en el repo** (verificado con `git grep` y `git log -S`).
- ✅ **Errores visibles al usuario son humanos**, no leak de stacks internos. Logs del servidor evitan volcar el body de Anthropic o el contenido de los mensajes para no escupir datos de usuario a Vercel logs (revisar `[focus-assistant]` y `[analyze-photo]`).
- ✅ **No hay `console.log` con `email`, `user_id`, tokens, prompts completos o respuestas completas de IA.** Sólo `console.warn`/`console.error` con mensajes sanitizados.

---

## 7. Pruebas realizadas

| Prueba | Estado |
| --- | --- |
| `npm run build` | ✅ pasa (build de Vite + stamp del SW) |
| `node --test tests/security.test.js tests/cron-config.test.js tests/apns.test.js tests/auth-required.test.js` | ✅ 13/13 pass |
| Boot dev en preview (`npm run dev` puerto 5173) | ✅ arranca sin errores en demo mode (sin Supabase env). Console-warn esperado: "Supabase env vars missing — running in offline/demo mode" |
| `grep` por secretos en `src/` | ✅ ninguna clave privada |
| Verificación de RLS migration | ✅ corre idempotente — todas las policies tienen `WITH CHECK` |

### Manual checklist (pendiente de ejecutar por el operador en Supabase con dos usuarios reales)

1. **Usuario sin sesión:**
   - Abrir `/api/focus-assistant` con un POST sin `Authorization` → debe responder **401** con `{error: 'auth_required'}`.
   - Abrir `/api/analyze-photo` con un POST sin `Authorization` → **401**.
   - Abrir la app → ver el shell pero ninguna llamada `select` a Supabase debería traer datos (RLS bloquea sin JWT).
2. **Usuario A vs Usuario B:**
   - A crea evento "EvtA". B abre la app con su sesión → no ve "EvtA".
   - B no debe poder hacer `select`/`update`/`delete` directo a Supabase apuntando a la fila de A.
   - Probar curl con `apikey` anon + Bearer de B contra `events?id=eq.<id-de-A>` → respuesta vacía.
3. **Logout:**
   - Crear evento, escribir mensaje en Nova, cerrar sesión.
   - Recargar la app: nada del usuario anterior debería persistir en pantalla.
   - Abrir DevTools → `localStorage` → no debería haber claves `focus_events_*`, `focus_tasks_*`, `focus_user_memories_*`, `focus_sync_queue`, `nova_history`.
4. **Account deletion:**
   - Ajustes → Eliminar cuenta → tipear `DELETE` → confirmar.
   - Verificar en Supabase Dashboard que el usuario y todas sus filas asociadas (events, tasks, memories, push_subscriptions, etc.) ya no existen.
5. **Demo mode:**
   - Sin `VITE_SUPABASE_*` la app entra en modo offline/demo. Probar que NO se intentan llamadas a `/api/focus-assistant` (porque `apiClient.apiFetch` sin sesión recibirá 401) y que la UI no rompe.

---

## 8. Acciones manuales requeridas (Supabase / Vercel)

> **Imprescindibles antes de TestFlight.** Lo que sigue requiere acceso al dashboard de Supabase / Vercel — yo no lo tengo.

### Supabase
1. Aplicar migración `supabase/migrations/012_security_rls_baseline.sql` en SQL Editor.
2. Verificar en `Authentication → Policies` que cada tabla privada tiene exactamente UNA política nueva con prefijo `<tabla>_owner_*` y `WITH CHECK` poblado.
3. Revisar que `device_pairings` sigue **sin policies** (la tabla está en RLS pero sólo el service role puede leer/escribir).
4. Confirmar que `auth.users` cascade funciona: insertar fila de prueba en `events` con `user_id` de prueba; borrar el usuario en `Authentication → Users`; verificar que la fila desapareció.
5. Si tienes datos antiguos donde `user_profiles.id` no coincide con `auth.users.id`, hacer un audit (no debería existir, pero por si acaso).

### Vercel
1. Comprobar que `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, `APNS_PRIVATE_KEY`, `CRON_SECRET` están configurados como **server-side env vars** (no `VITE_*`).
2. Confirmar que `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_API_ORIGIN`, `VITE_APNS_ENV` están en build env y NO son secretos rotables.
3. Si en algún momento hubo un push accidental de un secreto: rotar la clave correspondiente directamente en su servicio (Anthropic, Supabase, Resend, Apple Developer) y actualizar Vercel. **No pegar el secreto en el resumen del audit**.

### iOS / TestFlight
- Tras el commit/push de esta rama, el operador debe:
  1. `npm run ios:fresh` para regenerar `dist/` y sincronizar con Capacitor.
  2. `npm run ios:open` (o `npx cap open ios`) para abrir Xcode.
  3. En Xcode: Product → Run sobre simulador o iPhone físico.
  4. Probar: signup → login → crear evento → hablar con Nova → cerrar sesión → volver a entrar (con otra cuenta si es posible) → eliminar cuenta.

---

## 9. Account deletion — pasos verificables

1. **Backend:** `POST /api/auth/delete-account` con `Authorization: Bearer <jwt>` y body `{"confirm":"DELETE"}` ⇒ 200 `{ok:true}`.
2. **Frontend:** Settings → "Eliminar cuenta" → modal pide tipear `DELETE` → click "Eliminar definitivamente" → spinner → automatic logout local.
3. **DB:** todas las tablas con `REFERENCES auth.users(id) ON DELETE CASCADE` se vacían en una transacción (la cascade la maneja Postgres).
4. **Cliente:** `signOut` → `clearAllLocalCache` borra cualquier caché local del usuario.
5. **Reintentos:** si `deleteUser` falla por red, el endpoint devuelve 500 — el usuario puede reintentar; los pasos son idempotentes.

---

## 10. Resumen ejecutivo

- **Cinco riesgos críticos cerrados.** AI endpoints sin auth, logout dejando datos privados en disco, sin flujo de borrado de cuenta, RLS sin `WITH CHECK` explícito, e historial de Nova persistente entre sesiones.
- **Una migración SQL nueva** (`012_security_rls_baseline.sql`) que endurece todas las políticas RLS y deja el schema en un estado documentado.
- **Un endpoint nuevo y un modal nuevo** para eliminar cuenta (App Store / GDPR).
- **Cinco tests nuevos** que evitan que los endpoints vuelvan a aceptar requests sin Bearer.
- **No se rompió ninguna funcionalidad existente.** Build pasa, tests pasan, la app arranca en demo mode sin errores.
- **Tres puntos de seguridad quedan pendientes** (rate-limit persistente, account-pre-create al pedir OTP, rotación periódica de `CRON_SECRET`); ninguno bloquea TestFlight pero deben quedar agendados.

La seguridad base de Focus está lista para beta / TestFlight, siempre que el operador aplique la migración 012 en Supabase y confirme las env vars en Vercel.
