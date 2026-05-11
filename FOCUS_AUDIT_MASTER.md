# Focus — Audit Master

Documento central de auditoría continua del proyecto Focus.

- **Última revisión**: 2026-05-11 (Fase 1 audit pass)
- **Branch auditada**: `main` @ `63506ea` (worktree en `claude/nervous-snyder-7547ac`)
- **App nativa**: `ios-native/Focus.xcodeproj` (Swift/SwiftUI, iOS 17+)
- **Bundle**: `me.usefocus.app` · **Team**: `D8UM897B2T`
- **Backend**: Supabase + Vercel APIs · **Dominio**: `usefocus.me`

> Este archivo se mantiene actualizado a cada sesión de auditoría. Cada sección tiene un **Estado actual** (lo que sabemos) y **Pendientes** (lo que falta verificar/corregir).

---

## Audit pass log

| # | Fecha | Tipo | Resumen |
|---|---|---|---|
| 1 | 2026-05-11 | Fase 1 read-only | Inventario de tools, audit de código Swift, schema Supabase desde repo, vercel.json, secrets básicos. Sin instalaciones. Sin cambios de código. |

---

## 1. App nativa (`/ios-native`)

### Estado actual (2026-05-11)
- **19 archivos Swift · 4 445 líneas** en `ios-native/Focus/`.
- Stack: SwiftUI nativo puro, **sin Pods ni SPM** todavía.
- Theme centralizado en `Shared/Theme.swift` (paleta light Gemini con azul focus `#2563EB` + acento Nova `#6366F1`).
- Estado global vía `FocusDataStore: ObservableObject` (inyectado por env).
- 4 tabs: Mi día / Calendario / Tareas / Ajustes. Nova ya no es tab — se invoca como sheet desde el FocusBar de Mi Día.
- Ejemplos en Mi Día y Tareas cuando el usuario no tiene datos propios (badge `EJEMPLO` + dashed border).
- pbxproj objectVersion 56 (Xcode 14 era) → archivos nuevos requieren editar `project.pbxproj` manualmente.

### Findings Fase 1 (read-only audit)
- ✅ **0** matches de `TODO|FIXME|XXX|HACK` en `ios-native/Focus/`.
- ✅ **0** strings visibles con `"FASE"` o `"Próximamente"` (refactor anterior limpió todo).
- ✅ **0** strings visibles con `"placeholder"`, `"WIP"`, `"Lorem"`.
- ✅ **0** force-unwraps (`!\s*$`, `.first!`, `as!`, `try!`) en código.
- ⚠️ Sin **SwiftLint** todavía → no hay enforcement automático.
- ⚠️ Sin **Periphery** → posible código muerto no detectado (post-refactor de fases).

### Pendientes
- [ ] Auditoría con **SwiftLint** + crear `.swiftlint.yml`.
- [ ] Detección de código muerto con **Periphery**.
- [ ] Audit warnings de Xcode al build Release (no solo Debug).
- [ ] Snapshot tests (`SnapshotTesting` SPM) para regresiones visuales.
- [ ] XCUITests para flujo crítico (boot → Mi Día → crear evento → ver en Mi Día).
- [ ] Profiling con **Instruments**: cold start, energía, scroll en timeline.
- [ ] Bundle size en Release vs Debug.
- [ ] Accessibility Inspector pass (VoiceOver, dynamic type).
- [ ] App Thinning report tras Archive.

---

## 2. Legacy web (`/src`)

### Estado actual
- React 18 + Vite + Tailwind. Producción en `usefocus.me` (Vercel).
- Convive con la nativa: comparten back-end (Supabase + Vercel APIs).
- Tests Playwright **1.59.1** existentes en `tests/e2e/` y `tests/audit/`. Configs `playwright.config.js` + `playwright.audit.config.js`.
- Scripts npm: `dev`, `build`, `test:e2e`, `test:audit`, `test:e2e:nova`.
- `legacy-capacitor-ios/` y `legacy-expo/` archivados — NO se buildean ni deployan.

### Findings Fase 1
- ✅ **`@playwright/test`** ya en `devDependencies` (versión 1.59.1). No necesita install global.
- ✅ Suite e2e + suite de audit configuradas.

### Pendientes
- [ ] Correr `npx playwright install` (descarga browsers, ~300MB) cuando vayamos a ejecutar tests.
- [ ] Verificar que `tests/e2e/` siguen verdes contra `main` actual.
- [ ] Correr `npm audit` y resolver vulns High/Critical.
- [ ] **osv-scanner** sobre `node_modules` para deps con CVE.
- [ ] Lighthouse / web-vitals audit para Performance, Accessibility, SEO.
- [ ] Verificar Service Worker versioning (`scripts/stamp-sw-version.mjs`).
- [ ] Detección de código no usado tras migrar a nativa (componentes Capacitor que sobraron).

---

## 3. Supabase

### Estado actual (2026-05-11)
- **17 migraciones** en `supabase/migrations/` + 1 nota (`APPLIED_016_017_NOTES.md`):
  - `001_add_timezone_to_profiles`
  - `002_device_pairings`
  - `003_drop_peak_zone`
  - `004_event_reminders_and_timezone`
  - `005_notification_deliveries`
  - `006_sent_notification_metadata`
  - `007_user_personality`
  - `008_quiet_hours`
  - `009_native_push_tokens`
  - `010_ai_usage`
  - `011_kairos_links`
  - `012_security_rls_baseline`
  - `013_ai_usage_events`
  - `014_notif_log`
  - `015_user_plans`
  - `016_task_subtasks_and_links`
  - `017_task_due_dates`
- `supabase/schema.sql` (16KB) declara **15 tablas**:
  - `user_profiles`, `events`, `tasks`, `blocks`, `suggestions`, `user_memories`, `notif_log`, `user_signals`, `user_behavior`, `push_subscriptions`, `native_push_tokens`, `sent_notifications`, `calendar_feeds`, `ai_usage_events`, `user_plans`.
- ✅ **15/15 tablas** tienen `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` en `schema.sql` (RLS coverage 100% a nivel declarado).

### Findings Fase 1
- ⚠️ No se pudo verificar **prod vs local** (Supabase CLI no instalado).
- ⚠️ No se auditaron políticas RLS individuales — solo que RLS está activada.
- ⚠️ Migración `010_ai_usage` está pero no veo tabla `ai_usage` en `schema.sql` (sí está `ai_usage_events`). Verificar si `ai_usage` se renombró o se eliminó.

### Pendientes
- [ ] Conectar **Supabase CLI** con read-only para audit (instalación pendiente; OAuth manual).
- [ ] Resolver disrepancia `ai_usage` vs `ai_usage_events` (¿está la primera obsoleta?).
- [ ] Listar policies de cada tabla y verificar `USING` + `WITH CHECK`.
- [ ] Confirmar que `user_plans` y `ai_usage*` no exponen datos cross-user.
- [ ] Confirmar que el `service_role` NUNCA está expuesto al cliente.
- [ ] Snapshot del schema actual de **prod** para diff contra `schema.sql` local.
- [ ] Backup verificado (Supabase dashboard → Settings → Database).
- [ ] Audit privacy: campos PII (`email`, `phone`) cifrados o policy estricta.

### Tablas a auditar (orden de prioridad)
1. `user_plans` — billing-sensitive
2. `ai_usage_events` — uso/costo Nova
3. `events`, `tasks` — datos personales
4. `user_memories`, `user_behavior` — sensibles de comportamiento
5. `native_push_tokens`, `push_subscriptions` — device tokens (no rotables fácil)

---

## 4. Vercel

### Estado actual (2026-05-11)
- `vercel.json` presente, esquema Vite, build `npm run build`, output `dist/`.
- Sin `.vercel/` enlazado (no hay link local).
- Despliegue automático a `main` (per CLAUDE.md: "solo `main` → producción").
- APIs serverless en `/api/`: `focus-assistant`, `transcribe`, `analyze-photo`, `auth/email/send-otp`, `push`, `calendar-feeds`, `me`, `stripe-webhook`, `cron-notifications`, etc.

### Findings Fase 1 — Análisis de `vercel.json`
- ✅ **Headers de seguridad excelentes**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2 años)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), bluetooth=()`
- ✅ **CSP** bastante estricta: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org`.
- ⚠️ **`script-src` incluye `'unsafe-inline'`** — limitación típica de Vite con módulos inline. Mejora futura: usar nonces o hashes. **No bloqueante** para release.
- ✅ `style-src` incluye `https://fonts.googleapis.com` y `font-src` incluye `https://fonts.gstatic.com` — fonts externas explícitas (OK).
- ✅ `sw.js` con `Cache-Control: no-cache, no-store, must-revalidate` — SW siempre fresh.
- ✅ `cleanUrls: true`, `trailingSlash: false` — URLs limpias.

### Pendientes
- [ ] Conectar **Vercel CLI** read-only (`vercel link` y `vercel ls`).
- [ ] Inventario de env vars en producción (sin descargar valores con `vercel env pull`).
- [ ] Listar últimos 20 deploys, status, duración.
- [ ] Verificar que ninguna env var pública (`VITE_*`) contiene service_role.
- [ ] Health checks en endpoints clave.
- [ ] Logs últimas 24h: errores 500, timeouts, rate limit hits.
- [ ] Cron `notifications-cron.yml` ejecutándose (GitHub Actions).
- [ ] Verificar rate limit / abuse protection en `/api/focus-assistant`.

---

## 5. GitHub

### Estado actual (2026-05-11)
- Branch principal: `main`. Trabajo actual en worktree branch `claude/nervous-snyder-7547ac`.
- Últimos commits en main:
  - `63506ea` — feat: rediseño Gemini light + Nova omnipresente + ejemplos
  - `07fa36d` — feat: build functional native Focus V1
  - `0d87f02` — feat: add native tab shell and Mi Día demo timeline
  - `6bd2bc7` — chore: reorganizar para app iOS nativa Swift/SwiftUI
- 1 workflow CI: `.github/workflows/notifications-cron.yml` (cron de push notifications).
- `gh` CLI 2.92.0 instalado.

### Findings Fase 1
- ⚠️ **`gh` CLI NO está autenticado** (`gh auth status` → "You are not logged into any GitHub hosts"). Bloquea cualquier acción de PR/issue desde Claude. Login manual requerido (ver Apéndice C).
- ✅ Único workflow CI activo: cron de notificaciones.

### Pendientes
- [ ] `gh auth login` ejecutado manualmente por Martin (no por Claude).
- [ ] Branch protection en `main` (require PR, status checks).
- [ ] Secret scanning habilitado a nivel repo.
- [ ] Dependabot alerts.
- [ ] CI: workflow para `swiftlint` + `xcodebuild` en cada PR que toque `ios-native/`.
- [ ] CI: workflow para `playwright` en PRs que toquen `/src`.
- [ ] PRs abiertos / Issues abiertos: triage.
- [ ] Verificar que no hay `git push --force` reciente sobre main.

---

## 6. Seguridad

### Estado actual (2026-05-11)
- `.env.example` existe con placeholders (no valores reales).
- `.gitignore` ignora `.env*` reales (asumido — verificar).
- `.claude/settings.local.json` no se commitea.

### Findings Fase 1 — Escaneo de secrets (read-only, sin imprimir valores)
- ✅ **0 matches** de patrones de secret conocidos en código y configs:
  - `sbp_[A-Za-z0-9]{16,}` (Supabase project tokens)
  - `sk_(live|test)_[A-Za-z0-9]{16,}` (Stripe)
  - `AIza[A-Za-z0-9_-]{30,}` (Google API)
  - `xox[baprs]-[A-Za-z0-9-]{10,}` (Slack)
  - `ghp_[A-Za-z0-9]{20,}`, `github_pat_[A-Za-z0-9_]{20,}` (GitHub tokens)
- ✅ **`service_role` aparece SOLO en código server-side**:
  - `api/_supabaseAdmin.js` (comentario + lectura de env)
  - `api/me/plan.js` (uso documentado del admin client con filtro server-side)
- ✅ **NO aparece `service_role` en `src/`** (cliente web limpio).
- ✅ `.env.example` exclusivamente con placeholders (`xxx`, `...`, `re_...`, etc.).
- ⚠️ No se corrió **gitleaks** sobre todo el historial — solo grep del HEAD actual. Pendiente para Fase 2.

### Pendientes críticos
- [ ] **gitleaks** scan completo del historial: `gitleaks detect --redact --source . --report-path /tmp/gitleaks-report.json`.
- [ ] **semgrep** con rulesets `auto`, `p/security-audit`, `p/owasp-top-ten`, `p/secrets`, `p/swift`.
- [ ] **osv-scanner** sobre `package-lock.json` (y futuro `Package.resolved` cuando agreguemos SPM).
- [ ] Auditar dependencias del web (`npm audit --omit=dev`).
- [ ] Validar JWT verification en cada `/api/*` (rechazar tokens expirados/inválidos).
- [ ] Rate limit en `/api/focus-assistant` y `/api/transcribe` (anti-abuse / billing).
- [ ] PIA (Privacy Impact Assessment) actualizado en `PRIVACY_AUDIT.md`.

### Endpoints sensibles a re-validar
- `/api/auth/email/send-otp` — anti-enumeration
- `/api/focus-assistant` — input sanitization, no PII en logs
- `/api/transcribe` — file size limit, content-type check
- `/api/analyze-photo` — same + EXIF strip
- `/api/auth/delete-account` — require `confirm: 'DELETE'` real, no race

---

## 7. Diseño

### Estado actual
- Paleta light Gemini-style centralizada en `Theme.swift`.
- 4 tabs limpios.
- Empty states con ejemplos + dashed border (no pantallas vacías).
- Bottom tab bar safety: `Theme.Spacing.bottomBarSafety = 110`.
- Idioma: español "tú" neutral. Sin voseo.

### Findings Fase 1
- ✅ **Cero textos internos visibles** (`"FASE..."`, `"Próximamente"`, `"placeholder"`, `"WIP"`, `"Lorem"`).
- ✅ Refactor Gemini light limpió pantallas vacías.

### Pendientes
- [ ] Audit en **iPhone físico** (no solo simulador): safe areas con Dynamic Island.
- [ ] Audit en **iPhone SE** (pantalla más chica) — overflow / truncations.
- [ ] Test con **Dynamic Type XL/XXL** — texto cortado.
- [ ] Test modo **dark del sistema** — confirmar que `.preferredColorScheme(.light)` lo bloquea correctamente.
- [ ] Test con **reduce motion** activado.
- [ ] Test con **VoiceOver** — todas las cards tienen labels.
- [ ] Test con **idioma del sistema en inglés** — fechas y copy en español hardcoded, ver si rompe layouts.
- [ ] Comparación visual con: Things 3, Notion Calendar, Apple Calendar, Sunsama, Cron, Linear.
- [ ] Audit copy: tono consistente, sin tecnicismos en empty states.

---

## 8. Performance

### Estado actual
- Sin instrumentación todavía.
- Build Debug pasa en ~30s para device físico.
- Sin tests de cold start ni profiling.

### Pendientes
- [ ] **Cold start** medido con Instruments en iPhone 16 físico: target <600ms.
- [ ] **Time to first content** (boot → Mi Día interactiva): target <1.8s.
- [ ] Profiling de scroll en Mi Día timeline con many events.
- [ ] Profiling de tap → sheet de Nova (transición spring).
- [ ] **Bundle size** (Archive Release): target <15MB.
- [ ] **Build time** Debug vs Release.
- [ ] Memory footprint en uso normal — target <80MB RAM.
- [ ] Energy impact al estar idle en Mi Día.
- [ ] Warnings Xcode Release: cero esperado.

---

## 9. QA

### Estado actual
- Sin tests automatizados para la app nativa.
- Tests Playwright existentes para la web legacy (`tests/e2e/`, `tests/audit/`).
- Build manual via `xcodebuild` + install via `devicectl`.

### Pendientes
- [ ] **XCUITest** smoke suite:
  - [ ] Boot → Mi Día se renderiza sin crash
  - [ ] Tap FocusBar → sheet Nova se abre
  - [ ] Submit texto → respuesta Nova aparece
  - [ ] Cambiar tabs sin crash
  - [ ] Tap FAB Tareas → sheet crear → guardar → aparece en lista
  - [ ] Tap FAB Calendario → crear evento → aparece en día seleccionado
  - [ ] Aprobar sugerencia en Bandeja → status approved
- [ ] **Snapshot tests** SwiftUI:
  - [ ] BootView light
  - [ ] MiDiaView empty (ejemplos)
  - [ ] MiDiaView con datos reales
  - [ ] Nova sheet abierto
  - [ ] Bandeja con sugerencias
- [ ] **Playwright** legacy: `npx playwright install` + re-correr suite.
- [ ] **Manual QA** matriz: iPhone 16, iPhone 15, iPhone SE, iPad (si soportado).

---

## 10. IA / Nova

### Estado actual
- Nova en la app nativa: **mock local** (`NovaResponder` con keyword matching).
- Backend real `/api/focus-assistant` existe pero NO conectado a la app nativa todavía.
- Bandeja con 5 sugerencias demo orientadas a universitario + trabajador.

### Pendientes
- [ ] Conectar `NovaService` Swift a `/api/focus-assistant`.
- [ ] Auth Supabase OTP funcional → token JWT en cada request.
- [ ] Manejo de errores: quota_exceeded, timeout, network.
- [ ] Audit del system prompt: ¿incluye PII innecesaria del usuario?
- [ ] Audit de `ai_usage_events`: tokens consumidos por user, costo estimado.
- [ ] Rate limit cliente para evitar burst spending.
- [ ] Conexión foto → `/api/analyze-photo` (no implementado en nativa).
- [ ] Voice dictation: `Speech` framework nativo iOS.
- [ ] Personalidad Nova (Focus/Cercana/Estratégica) viaja al backend.

---

## 11. App Store / TestFlight

### Estado actual
- Build interno funcionando en iPhone físico vía `devicectl`.
- Sin Archive ni upload a App Store Connect todavía.
- Documentación en `docs/app-store.md` y `docs/app-store-metadata.md`.

### Pendientes (orden cronológico)
- [ ] App Store Connect: crear app con bundle `me.usefocus.app`.
- [ ] Iconos finales en todas las resoluciones (`Assets.xcassets/AppIcon`).
- [ ] LaunchScreen Storyboard / config.
- [ ] Info.plist: usage descriptions de cámara, mic, calendario, notificaciones.
- [ ] Capabilities: Push Notifications, Sign in with Apple, Calendars (si EventKit).
- [ ] Privacy Nutrition Labels completos.
- [ ] Privacy policy URL pública (`usefocus.me/privacidad`).
- [ ] App Store screenshots (6.7" + 6.1" + iPad si aplica).
- [ ] Promo text + description + keywords.
- [ ] Build Release sin warnings.
- [ ] Archive + upload a TestFlight.
- [ ] Internal testing con ≥3 testers.
- [ ] Reseteo de provisioning para distribution (Apple Distribution cert).

---

## 12. Pendientes críticos (urgentes)

> Bloquean cualquier release/beta.

- [ ] **Persistencia local** de tareas/eventos creados (`UserDefaults` o `SwiftData`). Hoy se pierden al matar app.
- [ ] **Auth real** (Supabase OTP) en la app nativa.
- [ ] **Nova conectada** al backend real (no mock).
- [ ] **Rate limit** server-side en `/api/focus-assistant` para abuse.
- [ ] **gitleaks** clean run sobre todo el historial.
- [ ] **RLS audit** completo sobre todas las tablas Supabase.
- [ ] **`gh auth login`** manual para habilitar acciones GitHub desde Claude.

---

## 13. Pendientes visuales

- [ ] Animación sparkle pulsante en FocusBar (sutil, con `.symbolEffect`).
- [ ] Indicador "Nova está escribiendo" (3 dots animados) durante respuesta mock.
- [ ] Skeleton loaders en lugar de empty states cuando datos están cargando.
- [ ] Onboarding mínimo (1 sola pregunta opcional post-login).
- [ ] Confirmación visual al crear primer evento (toast / haptic + animation que los ejemplos se vayan).

---

## 14. Pendientes backend

- [ ] Migración de `events` y `tasks` con columnas iOS-friendly si hace falta.
- [ ] Endpoint para `device_tokens` APNs registration desde la nativa.
- [ ] Webhook Stripe (`/api/stripe-webhook`) para Pro.
- [ ] Endpoint de health-check público (`/api/health`).
- [ ] Logs estructurados (JSON) para todos los endpoints sensibles.

---

## 15. Checklist antes de beta (TestFlight interno)

> Mínimo viable para empezar a probar con usuarios.

- [ ] Auth Supabase OTP funcional end-to-end.
- [ ] Mi Día persiste datos (mínimo `UserDefaults`).
- [ ] Tareas y Calendario persisten datos.
- [ ] Nova conectada al backend real con manejo de errores.
- [ ] Push notifications APNs registradas (al menos token guardado en Supabase).
- [ ] App pasa `xcodebuild archive` sin errors ni warnings críticos.
- [ ] Iconos + LaunchScreen finales.
- [ ] Info.plist con todas las usage descriptions.
- [ ] gitleaks limpio.
- [ ] `npm audit` sin Critical en web.
- [ ] Privacy policy publicada.
- [ ] Build #1 en TestFlight Internal con tester invitado.

---

## 16. Checklist antes de producción (App Store público)

- [ ] Beta TestFlight con ≥10 testers durante ≥2 semanas.
- [ ] Crash rate <0.5% (vía App Store Connect analytics).
- [ ] Manejo robusto de offline (queue + sync).
- [ ] Backup database verificado en Supabase.
- [ ] Sign in with Apple disponible (Apple lo exige si hay otros OAuth).
- [ ] Delete account flow funcional (PIA compliance).
- [ ] App Store Privacy Nutrition Labels finalizados.
- [ ] Screenshots App Store finales en 6.7" + 6.1".
- [ ] App Review Information completa (demo account + notes).
- [ ] Pricing tier configurado (Free + Pro con IAP o Stripe).
- [ ] Localización a inglés si target US (opcional).
- [ ] Términos de servicio publicados.
- [ ] Política de privacidad publicada y actualizada.

---

## Apéndice A — Inventario de herramientas (2026-05-11)

| Herramienta | Versión | Estado | Función |
|---|---|---|---|
| Xcode | 26.4.1 (17E202) | ✅ | Build/Archive iOS |
| `gh` CLI | 2.92.0 | ⚠️ instalado pero **no logueado** | GitHub ops |
| Node | 24.14.1 | ✅ | Web + scripts |
| npm | 11.11.0 | ✅ | Web deps |
| Playwright | 1.59.1 (devDep) | ✅ | E2E web |
| Homebrew | 5.1.10 | ✅ | Package manager |
| SwiftLint | — | ❌ | Linting Swift |
| Periphery | — | ❌ | Dead code Swift |
| xcbeautify | — | ❌ | Build output legible |
| gitleaks | — | ❌ | Secret scanning |
| osv-scanner | — | ❌ | Vulns en deps |
| Supabase CLI | — | ❌ | Migraciones / RLS audit |
| Vercel CLI | — | ❌ | Deploys / env |
| Semgrep | — | ❌ | SAST |

## Apéndice B — MCPs disponibles relevantes

- ✅ `Claude in Chrome` — puede correr tests visuales en `usefocus.me`.
- ✅ `Computer Use` — para auditoría visual de la app en simulador/device.
- ✅ `Notion` — para volcar resultados de auditoría.
- ✅ `Claude Preview` — para mockups o snapshots.
- ⚠️ `Netlify` — **no es nuestro host**, ignorar.
- ❌ Supabase MCP — **NO conectado** (decisión consciente). Riesgo alto si se conecta con `service_role`. Alternativa: usar Supabase CLI con OAuth + read-only.
- ❌ GitHub MCP — **NO conectado**. Bajo riesgo si se conecta con PAT scope `repo:read`. Por ahora alcanza con `gh` CLI.

## Apéndice C — Acciones que requieren intervención humana (NO Claude)

Estas acciones requieren input directo de Martin y NO deben ser ejecutadas por Claude:

1. **`gh auth login`** — autenticación interactiva via browser / device code.
2. **`supabase login`** — OAuth browser.
3. **`vercel login`** + **`vercel link`** — autenticación + selección de proyecto.
4. **`supabase db push` / `db reset`** — DESTRUCTIVO. Sólo manual con confirmación.
5. **`vercel env pull` / `add` / `rm`** — toca secretos de producción.
6. **`brew install`** de cualquier herramienta — el primer install requiere `sudo` opcional según permisos del sistema. Mejor manual.
7. **TestFlight upload** — credenciales de App Store Connect.
8. **APNs `.p8` upload** a Supabase / Vercel — material sensible.
9. **Stripe webhook secret** — material sensible.

## Apéndice D — Documentos relacionados en el repo

| Doc | Propósito |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | Protocolo de trabajo Claude×Codex, idioma, push rules. |
| `IOS_NATIVE_MIGRATION.md` | Plan de migración nativa (Fase 1 completada). |
| `MOBILE_EXPO_MIGRATION.md` | Spec mobile heredada (referencia histórica). |
| `MOBILE_NATIVE_FEEL_AUDIT.md` | Estándar premium iOS (haptics, gestos, motion). |
| `AUTH_SESSION_AUDIT.md` | Flujo Supabase OTP, OAuth, delete-account. |
| `AI_COST_TRACKING.md` | Cost tracking de Nova (`ai_usage_events`). |
| `USAGE_LIMITS.md` | Límites Free/Pro y enforcement. |
| `PRIVACY_AUDIT.md` / `PRIVACY_POLICY_DRAFT.md` | PIA + draft de política. |
| `SECURITY_AUDIT.md` | Audit de seguridad previa (releer y comparar con findings nuevos). |
| `IOS_REAL_QA.md` | QA standards para builds reales. |
| `docs/MIGRATION_SPECS/01-mi-dia.md` | Spec quirúrgica de Mi Día. |
| `docs/push-notifications-setup.md` | APNs setup + cron. |
| `docs/app-store.md` / `app-store-metadata.md` | Posicionamiento App Store. |
| `docs/plan-de-3-semanas.md` | Roadmap producto. |

---

_Mantenido por Claude Code + Martin Núñez. Update cada vez que se cierra una fase o se agrega herramienta._
