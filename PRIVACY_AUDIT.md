# Privacy audit — Focus

Auditoría completa de qué datos recopila Focus, dónde se guardan, para qué se
usan, qué se comparte con terceros y qué se borra al eliminar la cuenta.

Última revisión: 2026-05-07. Owner: Martín. Estado: borrador técnico.

---

## 1. Resumen ejecutivo

Focus es una app de productividad que guarda **eventos**, **tareas** y
**memorias** del usuario en Supabase, llama a **Anthropic** (Claude) para Nova
y ofrece **notificaciones push** vía APNs/Web Push. No usamos analytics de
terceros, no vendemos datos, y la cuenta se puede eliminar desde Ajustes.

Lo que más aproxima a riesgo de privacidad:
- Memorias de Nova (texto libre que el modelo aprende del usuario).
- Mensajes de Nova (que se mandan a Anthropic con contexto del calendario).
- Tokens de push (envían contenido de notificaciones desde nuestros servidores).

---

## 2. Tabla maestra: dato → uso → retención

| Dato recopilado | Dónde se guarda | Para qué | ¿Necesario? | ¿Tercero recibe? | Retención | ¿Borrado al eliminar cuenta? |
| --- | --- | --- | --- | --- | --- | --- |
| Email | `auth.users` (Supabase) | Login, recuperación contraseña, OTP | Sí | Resend (envío de OTP) | Mientras la cuenta exista | Sí (CASCADE) |
| Password hash | `auth.users` (Supabase Auth) | Login | Sí | No | Mientras la cuenta exista | Sí |
| user_id (UUID) | `auth.users` y FK en todas las tablas | Identificar dueño de los datos | Sí | Anthropic (incluido en logs internos de su API; no en prompts) | Mientras la cuenta exista | Sí |
| Sesión (JWT) | localStorage Supabase + cookies | Auth persistente | Sí | No | TTL del access token, refresh hasta que el user cierra sesión | Invalidado al eliminar cuenta |
| OTP de email | RAM del backend (no persiste) | Verificación de inicio de sesión | Sí | Resend (lo envía) | Minutos | N/A |
| Tareas (label, priority, category, done) | `public.tasks` | Lista del usuario | Sí | No | Mientras la cuenta exista | Sí (CASCADE) |
| Eventos (title, time, date, description, section, icon) | `public.events` | Calendario del usuario | Sí | No | Mientras la cuenta exista | Sí (CASCADE) |
| Memorias de Nova (texto libre) | `public.user_memories` | Personalización de respuestas Nova | Sí (feature) | Anthropic (van en system prompt) | Mientras la cuenta exista, salvo `expires_at` | Sí (CASCADE) |
| Sugerencias pendientes | `public.suggestions` | Modo propuesta Nova | Sí | No | Hasta aprobar/rechazar | Sí (CASCADE) |
| Behavior model (agregado: peak hour, tipos aprobados, engagement) | `public.user_behavior` | Personalización Nova | Sí (feature) | Anthropic (resumen en system prompt) | Recalculado periódicamente | Sí (CASCADE) |
| Signals (eventos como task done, msg Nova) | `public.user_signals` | Construir behavior model | Sí (feature) | No | Mientras se use para reanálisis (~30d uso real) | Sí (CASCADE) |
| Perfil productividad (chronotype, role, timezone) | `public.user_profiles` | Personalización Nova + scheduler push | Sí | No | Mientras la cuenta exista | Sí (CASCADE) |
| Preferencias UX (Nova personality, quiet hours) | `public.user_profiles` + `localStorage focus_app_prefs_v1` | Tono de Nova + horario notificaciones | Sí | No | Mientras la cuenta exista | Sí (CASCADE; localStorage en delete-account) |
| Plan del usuario (free/early_access/admin) | `public.user_plans` | Aplicar límites del plan | Sí | No | Mientras la cuenta exista | Sí (CASCADE) |
| Contadores de cuotas IA (action_type, day, count) | `public.ai_usage` | Enforcement de límites diarios | Sí | No | Histórico (no se borra automático) | Sí (CASCADE) |
| Eventos de uso IA (tokens, costo, modelo, action_type, metadata) | `public.ai_usage_events` | Reportes de costo, futuras alertas | Sí (operacional) | No | Histórico (cleanup mensual pendiente) | Sí (CASCADE) |
| Mensajes a Nova | NO se persisten en DB; solo `sessionStorage nova_history` (últimos 40) | Mostrar conversación al usuario | Sí | Anthropic (cuerpo del prompt) | Hasta logout/cerrar pestaña | N/A en backend; sessionStorage limpiado al logout |
| Respuestas de Nova | NO se persisten | Mostrar al usuario | Sí | N/A | Hasta logout | N/A |
| Web Push subscription (endpoint, p256dh, auth) | `public.push_subscriptions` | Enviar notificaciones | Sí | Servicios push del navegador (Apple/Google/Mozilla) | Mientras la suscripción exista | Sí (CASCADE) |
| APNs token (iOS) | `public.native_push_tokens` | Enviar push en build nativa | Sí | Apple Push Notification Service | Mientras el token exista | Sí (CASCADE) |
| Notif log (entregadas in-app) | `public.notif_log` | Historial campanita | Sí | No | Histórico | Sí (CASCADE) |
| Sent notifications (dedup) | `public.sent_notifications` | Evitar duplicados | Sí | No | Histórico | Sí (CASCADE) |
| Notification deliveries (intentos APNs) | `public.notification_deliveries` | Diagnóstico push | Operacional | No | Histórico | Sí (CASCADE) |
| Calendar feed token | `public.calendar_feeds` | Suscripción ICS (Google Cal, Apple Cal, etc.) | Solo si feed creado | El proveedor que se suscriba al feed lee los eventos | Mientras el token exista | Sí (CASCADE) |
| Kairos links | `public.kairos_links` | Integraciones futuras | Solo si user las usa | (depende del provider) | Mientras se usen | Sí (CASCADE) |
| Device pairing (legacy QR) | `public.device_pairings` | Vinculación entre dispositivos (deshabilitado) | Legacy | No | Histórico | Sí (CASCADE) |
| Cache local de eventos / tareas / etc. | localStorage `focus_*` (con prefijo `_<userId>` por usuario) | Funcionar offline / acceso instantáneo | Sí | No | Hasta logout (helper privacyCleanup) | Sí (clearAllUserDataLocal) |
| Historial Nova local | sessionStorage `nova_history` | UX continua | Sí | No | Hasta logout / cerrar pestaña | Sí (clearPrivateUserDataLocal) |
| Flags UX (welcome visto, hints dismissed) | localStorage `focus_welcome_last`, `focus_hint_*`, `focus:day_started:*`, `focus_app_prefs_v1` | UX | No-PII | No | Persiste al logout (intencional); borrado al delete-account | Sí (clearAllUserDataLocal) |
| IP del cliente | Logs Vercel | Rate limit por IP, debug | Sí | Vercel | Logs Vercel (≤30 días en plan Hobby) | No aplica (no asociado a user_id en DB) |

---

## 3. Datos que NO se guardan

Decisión consciente: estos datos **no entran a ninguna tabla nuestra**.

- Prompts completos enviados a Nova
- Respuestas completas de Nova (solo viven en sessionStorage del browser)
- Mensajes individuales de la conversación
- Contenido literal de eventos / tareas en logs o tracking de costos
- Emails en logs de errores (sanitizado en `send-otp.js`)
- Tokens de auth o API keys en logs
- Datos de calendario/contactos/fotos del dispositivo (no se acceden)
- Geolocalización
- Contactos (del dispositivo)
- Datos de salud / financieros / pago
- Analytics de terceros (no usamos GA, Mixpanel, etc.)
- Identifiers de dispositivo (IDFA, IDFV, etc.)

---

## 4. Qué se manda a Anthropic / Nova

`/api/focus-assistant` arma un system prompt con:
- Fecha y zona horaria del usuario.
- Cronotipo + role del perfil.
- Behavior model agregado (sin contenido textual).
- Memorias de Nova (texto libre, hasta 40, ej. "Su pareja se llama Ana").
- Eventos del usuario: solo `title`, `time`, `date`, `featured`, `section`. **No** description completa cuando es larga.
- Tareas del usuario: solo `label`, `priority`, `done`. **No** notas privadas.
- Mensaje del usuario actual.
- Últimos 20 turnos del historial.

Lo mínimo necesario para que Nova personalice respuestas. **No** se envían:
- Email del usuario.
- user_id.
- Tokens de auth.
- IPs.
- Contenido de calendarios externos suscritos.

`/api/analyze-photo` envía:
- La imagen base64 (solo en el call al modelo, no se guarda).
- Un prompt de extracción de eventos (sin datos del usuario).

Anthropic procesa estos datos según su política
(<https://www.anthropic.com/legal/commercial-terms>) — hoy no los usan para
entrenamiento por defecto en API requests con `x-api-key`.

---

## 5. LocalStorage / SessionStorage

Mapa canónico en [src/lib/privacyCleanup.js](src/lib/privacyCleanup.js).

**Privadas** (limpiadas en logout y delete):
- `focus_events`, `focus_events_<userId>`
- `focus_tasks`, `focus_tasks_<userId>`
- `focus_suggestions`, `focus_user_profile`, `focus_user_memories`, `focus_user_behavior`
- `focus_task_links*`, `focus_task_parents*`
- `focus_sync_queue`, `focus_signals_queue`, `focus_migrated`
- `focus_pending_push_sub`, `focus_pending_native_token`
- `nova_history` (sessionStorage)

**UX flags** (limpiadas solo en delete-account, persisten en logout):
- `focus_welcome_last`
- `focus_hint_<id>`
- `focus_inbox_demo_dismissed_v1`
- `focus_nova_tutorial_dismissed`
- `focus_onboarding_chips_dismissed`
- `focus_empty_day_banner_dismissed`
- `focus_app_prefs_v1` (Nova personality, etc.)
- `focus:day_started:<date>`, `nova_last_opened`

**Justificación**: las flags UX no son PII; borrarlas en logout obligaría al
mismo usuario a volver a ver onboarding. En delete-account asumimos que el
usuario quiere desaparecer del dispositivo, así que se borran también.

Service worker cache: estático (HTML/JS/CSS); no cachea respuestas con datos
del usuario.

---

## 6. Eliminación de cuenta

Endpoint: `POST /api/auth/delete-account` con Bearer + `{ confirm: 'DELETE' }`.

Algoritmo:
1. Validar JWT y obtener user_id.
2. Rate limit (5/min/IP).
3. `admin.auth.admin.deleteUser(userId, true)` en Supabase.
4. Postgres ejecuta CASCADE sobre todas las tablas con
   `REFERENCES auth.users(id) ON DELETE CASCADE` (lista en `delete-account.js`).
5. El cliente recibe 200 → llama `signOut()` + `clearAllUserDataLocal()`.

Tablas que se borran (CASCADE):
- `user_profiles`, `events`, `tasks`, `blocks`
- `suggestions`, `user_memories`, `notif_log`
- `user_signals`, `user_behavior`
- `push_subscriptions`, `native_push_tokens`
- `sent_notifications`, `calendar_feeds`
- `notification_deliveries`, `ai_usage`, `ai_usage_events`
- `user_plans`, `kairos_links`, `device_pairings`

**Tablas futuras**: si se agrega una tabla con datos del usuario, debe
incluir `REFERENCES auth.users(id) ON DELETE CASCADE`. Sin esto, los
datos quedarían huérfanos y romperíamos el contrato de borrado total.
Hay un comentario explícito en `delete-account.js` recordándolo.

**Lo que NO se borra (porque no nos pertenece):**
- Logs de Vercel (TTL del plan).
- Logs de Anthropic (TTL de su sistema; ver sus políticas).
- Push notification ya en cola en Apple/Google (se descartan al expirar el token).
- Email enviado por Resend (queda en la bandeja del usuario).

---

## 7. Exportación de datos del usuario

**No implementado todavía.** Cuando se necesite (App Store / GDPR), las
tablas a consultar serían:

```sql
-- Datos del usuario para exportación
SELECT * FROM public.user_profiles    WHERE id      = '<uuid>';
SELECT * FROM public.events           WHERE user_id = '<uuid>';
SELECT * FROM public.tasks            WHERE user_id = '<uuid>';
SELECT * FROM public.user_memories    WHERE user_id = '<uuid>';
SELECT * FROM public.suggestions      WHERE user_id = '<uuid>';
SELECT * FROM public.notif_log        WHERE user_id = '<uuid>';
SELECT * FROM public.user_plans       WHERE user_id = '<uuid>';
-- (omitir behavior/signals porque son agregados/internos)
```

**Lo que NO debería exportarse** (es interno/técnico, no significa nada para
el usuario):
- `ai_usage` y `ai_usage_events` (telemetría operacional)
- `user_behavior` (modelo agregado, lleno de tags internos)
- `user_signals` (eventos brutos)
- `device_pairings`, `kairos_links` (operacional)
- `sent_notifications`, `notification_deliveries` (debug)

**Implementación sugerida**: nuevo endpoint
`POST /api/auth/export-account` con Bearer, devuelve un JSON con las tablas
listadas arriba. UI: botón "Descargar mis datos" en Ajustes. Email opcional
con link de descarga (TTL 24h).

---

## 8. App Store Privacy Preparation

Esta sección es **preparación técnica**, no asesoría legal final. Antes de
publicar, validarla con un revisor legal.

Categorías relevantes según el formulario de App Store Connect:

| Categoría | Tipo | ¿Aplica? | Linked to user? | Tracking? | Detalle |
| --- | --- | --- | --- | --- | --- |
| Contact Info → Email | Sí | App Functionality | Linked | No | Para login/recovery |
| User Content → Other User Content | Sí | App Functionality | Linked | No | Eventos, tareas, memorias, mensajes Nova |
| Identifiers → User ID | Sí | App Functionality | Linked | No | UUID interno (no shared con terceros) |
| Identifiers → Device ID | **No** | — | — | — | No usamos IDFA/IDFV |
| Usage Data → Product Interaction | Sí | App Functionality + Analytics | Linked | No | ai_usage / ai_usage_events / signals |
| Diagnostics → Crash Data | Posible | App Functionality | Linked | No | Solo logs Vercel; sin Sentry/etc. |
| Diagnostics → Performance Data | Posible | App Functionality | Linked | No | duration_ms en ai_usage_events |
| Location | **No** | — | — | — | No accedemos al GPS |
| Contacts | **No** | — | — | — | El campo `contacts` en system prompt está vacío hoy |
| Calendars | **No** | — | — | — | No leemos el Calendar nativo del iOS |
| Photos / Camera | **Sí (cuando user sube foto)** | App Functionality | Not linked al user (la foto no se guarda) | No | analyze-photo procesa y descarta |
| Health & Fitness | **No** | — | — | — | No usamos HealthKit |
| Financial Info | **No** | — | — | — | No tocamos pagos todavía |
| Sensitive Info | **No** | — | — | — | — |
| Browsing History | **No** | — | — | — | — |
| Search History | **No** | — | — | — | — |
| Audio Data | **No** | — | — | — | Mic usa SpeechRecognition local del browser; el audio nunca llega a backend |

**Tracking** (en sentido del App Tracking Transparency framework): `No` —
no compartimos identifiers con data brokers ni red ads, no usamos
identifiers cross-app/cross-website.

**Antes de publicar**:
- Confirmar el uso real de Photos (sí, cuando el usuario sube manual).
- Confirmar que no se agregaron analytics terceros sin actualizar este doc.
- Validar la copy del Privacy Policy y vincularla en App Store Connect.

---

## 9. Servicios de terceros

| Proveedor | Datos que recibe | Para qué | Necesario | Notas |
| --- | --- | --- | --- | --- |
| **Supabase** (DB + Auth) | Todos los datos del usuario | Backend principal | Sí | EU/US (depende del project). Datos cifrados at rest. |
| **Anthropic** (Claude) | System prompt: memorias + eventos (titles) + tareas (labels) + behavior agregado + mensaje + 20 turnos historial | Generar respuestas Nova | Sí (feature) | Sin entrenamiento en API por defecto. Logs de Anthropic ≤30d (ver sus términos). |
| **Vercel** (hosting) | Body de requests, headers, IP | Servir API + frontend | Sí | Logs de runtime ≤30d. |
| **APNs** (Apple Push) | Token APNs + payload de push | Enviar notificaciones iOS | Sí (iOS) | Apple recibe el contenido visible de la push. |
| **VAPID Web Push** (FCM/Mozilla/Apple) | Endpoint + payload | Enviar notificaciones web | Sí (web) | El servicio del navegador procesa la push. |
| **Resend** (email) | Email del usuario + cuerpo del email con OTP | Enviar OTP de login y recovery | Sí | Solo se llama en el flow de OTP. |
| **OpenWeather** (vía `weather.js`) | Coordenadas (si el user las da) | Contexto climático para Nova | Opcional | Solo si el usuario comparte ubicación. |

**Variables de entorno** (todas backend, ningún `VITE_` privado):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase cliente (públicas, OK)
- `ANTHROPIC_API_KEY` — Claude
- `RESEND_API_KEY`, `EMAIL_FROM` — Resend
- `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_ENV` — Apple Push
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — Web Push
- `CRON_SECRET` — Auth de cron-notifications

**Variables eliminadas** (ver SECURITY_AUDIT.md): `OPENAI_API_KEY` (legacy de
TTS removido en commit `e4de579`).

---

## 10. RLS y verificación

Estado de RLS por tabla relevante (verificado en producción):

| Tabla | RLS | Policies | Quien escribe |
| --- | --- | --- | --- |
| `user_profiles` | ✓ | `user_profiles_owner_all` (FOR ALL, with_check) | El propio usuario |
| `events` | ✓ | `events_owner_all` (FOR ALL, with_check) | El propio usuario |
| `tasks` | ✓ | `tasks_owner_all` (FOR ALL, with_check) | El propio usuario |
| `user_memories` | ✓ | `user_memories_owner_all` (FOR ALL, with_check) | El propio usuario |
| `suggestions` | ✓ | `suggestions_owner_all` (FOR ALL, with_check) | El propio usuario |
| `user_signals` | ✓ | `user_signals_owner_all` (FOR ALL, with_check) | El propio usuario |
| `user_behavior` | ✓ | `user_behavior_owner_all` (FOR ALL, with_check) | El propio usuario |
| `push_subscriptions` | ✓ | `push_subscriptions_owner_all` | El propio usuario |
| `native_push_tokens` | ✓ | `native_push_tokens_owner_all` | El propio usuario |
| `notif_log` | ✓ | `notif_log_owner_all` | El propio usuario |
| `sent_notifications` | ✓ | `sent_notifications_owner_select` | service_role |
| `calendar_feeds` | ✓ | `calendar_feeds_owner_all` | El propio usuario |
| `kairos_links` | ✓ | (verificar) | service_role |
| **`user_plans`** | ✓ | `user_plans_owner_select` (solo SELECT) | **service_role only** |
| **`ai_usage`** | ✓ | `Users read own ai_usage` (solo SELECT) | **service_role only** |
| **`ai_usage_events`** | ✓ | `ai_usage_events_owner_select` (solo SELECT) | **service_role only** |
| `device_pairings` | ✓ | (sin policies de cliente) | service_role only |

Las **3 tablas críticas** del sistema de límites/costos (`user_plans`,
`ai_usage`, `ai_usage_events`) tienen escritura cerrada al cliente:
- Un usuario logueado **no puede** modificar su plan.
- Un usuario logueado **no puede** alterar contadores ni costos.
- Solo el backend con `service_role` escribe.

Verificación SQL ejecutada el 2026-05-07 (ver SECURITY_AUDIT.md).

---

## 11. Pendientes antes de TestFlight / App Store

**Crítico**:
- Validar Privacy Policy con un revisor (PRIVACY_POLICY_DRAFT.md).
- Configurar el formulario de App Store Privacy con la tabla de la sección 8.
- Confirmar que `OPENAI_API_KEY` está rotado/desactivado en OpenAI dashboard
  (ver SECURITY_AUDIT.md).

**Recomendado**:
- Implementar exportación de datos (sección 7) para cumplir GDPR si pivoteamos
  a EU.
- Cron mensual para borrar `ai_usage_events` >180 días.
- Cron mensual para borrar `notif_log` y `sent_notifications` >90 días.
- Documentar en la app cómo eliminar la cuenta (Ajustes → ya está, pero
  agregar mención en onboarding o legal).

**Opcional**:
- Permitir al usuario ver/borrar memorias individuales de Nova (la UI ya
  existe en MemoryView).
- Agregar opción "borrar historial de Nova" sin borrar la cuenta.
- Modo "incógnito" para conversaciones que no se guarden a memoria.
