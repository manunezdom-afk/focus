# TestFlight release readiness — checklist final

Estado tras las 5 fases del plan. Cada item ✅ está cerrado en el repo. Items ⚠️ requieren acción manual del owner.

---

## Build config

- ✅ `mobile/app.json` bundleIdentifier `me.usefocus.app.expo`
- ✅ `mobile/app.json` appleTeamId `D8UM897B2T`
- ✅ `mobile/app.json` version `0.1.0`, buildNumber `1`
- ✅ `mobile/ios/Focus/Info.plist` ITSAppUsesNonExemptEncryption = false
- ✅ NSCameraUsageDescription
- ✅ NSPhotoLibraryUsageDescription
- ✅ NSMicrophoneUsageDescription
- ✅ NSSpeechRecognitionUsageDescription (cerrado en `c8563d8`)
- ✅ Privacy manifest `mobile/ios/Focus/PrivacyInfo.xcprivacy`

## Assets

- ✅ App icon 1024×1024 en `mobile/assets/images/icon.png`
- ✅ Splash icon en `mobile/assets/images/splash-icon.png`
- ⚠️ App Store metadata (descripción, keywords, screenshots) — manual en App Store Connect

## Dev gating

- ✅ `(dev)/_layout.tsx` Redirect a `/` si !__DEV__
- ✅ `(dev)/mirror.tsx` Redirect a `/` si !__DEV__
- ✅ Settings sección Desarrollo gated con `{__DEV__ ? ... : null}`
- ✅ `LegacyMirror` lazy-loaded — el chunk se elimina en Release (cerrado en `c8563d8`)

## Release config

- ✅ `mobile/eas.json` con perfiles `development`, `preview`, `production`
- ✅ `mobile/scripts/archive-readme.md` con guía step-by-step
- ⚠️ `eas.json` `submit.production.ios.ascAppId` — placeholder, reemplazar tras crear app en App Store Connect

## Backend / API

- ✅ Supabase RLS owner-only en todas las tablas con datos de usuario
- ✅ `BETA_UNLIMITED=true` en Vercel env (set por owner durante FASE D anterior)
- ✅ `/api/auth/delete-account` funcional con confirm:'DELETE'
- ✅ `/api/me/plan` expone plan + uso + betaUnlimited
- ✅ `/api/focus-assistant` con Sonnet fallback Path B (cerrado en `61a127c`)
- ✅ Migrations 016 + 017 aplicadas en producción Supabase
- ✅ `ai_usage_events` registra Haiku + Sonnet con `premium_escalated` flag

## Mobile features

- ✅ Mi Día — eventos reales, NextBlockCard, EmptyDayState con seedNova
- ✅ Calendario — vistas Día/Semana/Mes, CreateEventSheet, refresh
- ✅ Nova — text + cámara + mic, Sonnet fallback en escenarios edge
- ✅ Tareas — CRUD, bulk defer, due_date/due_time, prefill Nova
- ✅ Ajustes — plan beta, eliminar cuenta funcional, notificaciones V1, apariencia override
- ✅ Notificaciones locales V1 con lazy require (no crashea sin native module)
- ✅ Dictado real on-device (expo-speech-recognition) con permission flow
- ✅ Apariencia Sistema/Claro/Oscuro persistida en AsyncStorage

## Bug fixes recientes

- ✅ Crash "Component is not a function" por memo + reactCompiler resuelto (`3ede435`)
- ✅ Lag percibido en Debug — perf optimizations (`c6e7115`, `2b33a07`) + tweaks Mi Día (`c220d66`, `d989e3a`)
- ✅ `#dc2626` literales reemplazados por `c.danger` (theme-aware) en `2b33a07`
- ✅ Hero halo Settings reducido para consistencia con Mi Día (`2b33a07`)

## Privacy & legal

- ✅ Borrador `mobile/docs/PRIVACY_POLICY.md` listo (no publicado)
- ⚠️ Para External Beta: completar TODOs del borrador, publicar en `usefocus.me/privacy`, pegar URL en App Store Connect → App Information → Privacy Policy URL
- ✅ Para Internal Beta: NO se requiere Privacy Policy URL pública

## Documentación

- ✅ `mobile/docs/QA_TESTFLIGHT.md` — matriz 30+10 tests con criterios
- ✅ `mobile/scripts/archive-readme.md` — guía Xcode local + EAS Build
- ✅ `mobile/docs/PRIVACY_POLICY.md` — borrador para futuro

---

## Pasos finales del owner para subir TestFlight Internal

### 1. (Una sola vez) Registrar app en App Store Connect
- https://appstoreconnect.apple.com → My Apps → "+" → New App.
- Platform: iOS. Name: "Focus". Primary Language: Spanish (Mexico).
- Bundle ID: seleccionar `me.usefocus.app.expo` (debe estar pre-registrado en developer.apple.com).
- SKU: arbitrario (ej: `focus-mobile-001`).
- User Access: Full Access.

### 2. (Una sola vez) Pegar Apple ID numérico en eas.json
- App Store Connect → focus-app → App Information → Apple ID (numérico, ej `1234567890`).
- Reemplazar `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` en `mobile/eas.json` con ese número (commit + push).

### 3. Archive desde Xcode
- Seguir `mobile/scripts/archive-readme.md` Camino A.
- Tiempo: 15-25 min cold + 5-10 min upload.

### 4. App Store Connect — TestFlight tab
- Esperar "Processing" (10-30 min).
- Cuando aparece "Ready to Submit":
  - Click el build → llenar "What to Test" (1-2 oraciones).
  - **Internal Testers**: agregar tu Apple ID. Recibes invite por email.
- NO requiere App Review para Internal beta.

### 5. Probar en iPhone via TestFlight app
- Aceptar invite (link en email).
- Tap "Install" en TestFlight.
- Probar la matriz de `mobile/docs/QA_TESTFLIGHT.md`.

### 6. Si hace falta otro build
- Bumpear `buildNumber` en `mobile/app.json` (Apple rechaza duplicados).
- Repetir Archive + Upload.

---

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Performance en Release no validada | QA matrix incluye smoke test. Si lag persiste: Instruments → Animation Hitches. |
| Sonnet 4.6 retorna costo más alto en escalaciones edge | `BETA_UNLIMITED=true` evita bloquear users; ai_usage_events tracking permite ver costo real per día. |
| `reactCompiler: true` experimental | Ya causó 1 crash (memo manual, resuelto). Si Release falla raro: rotar a `false` en app.json. |
| LegacyMirror lazy import + Suspense fallback en dev | Solo dev, fallback es ActivityIndicator simple. Sin impacto Release. |
| Privacy Policy ausente para External Beta | TODO del owner antes de invitar testers fuera del círculo cercano. |
| Apple sign in no implementado | Requerido SOLO si app ofrece OAuth con Google/Facebook. Email-only OTP es compliant — no necesita Apple Sign In. |

---

## Post-TestFlight (no bloqueante)

- Privacy Policy publicada para External Beta
- App icon variations + app preview videos para metadata App Store
- Detox/Maestro si los flujos crecen >15
- Apple Sign In si añadimos OAuth providers
- Push remoto APNs (V2 de notificaciones)
- Web legacy migrar localStorage → Supabase para subtasks/links
- Nova system prompt: agregar `parent_task_id` / `due_date` al schema de `add_task`
- Multi-calendar support
- Widgets (iOS 14+)
