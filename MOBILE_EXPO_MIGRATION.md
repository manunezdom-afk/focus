# Migración mobile a Expo / React Native

Documento de la migración desde la app Capacitor (carpeta `ios/`, build basado en `dist/` de Vite) hacia una app nativa de verdad en React Native + Expo (carpeta [`mobile/`](./mobile/)).

## 1. Por qué arrancamos una app Expo nueva

La app actual de Focus en App Store es una WebView de Capacitor sobre el bundle de Vite. Funciona, pero arrastra problemas estructurales que se hicieron evidentes durante el audit `MOBILE_NATIVE_FEEL_AUDIT.md`:

- Los gestos no se sienten 100% nativos (swipes, drag, scroll bouncing).
- El teclado iOS pelea con el viewport del WebView aun con los hacks que metimos (`src/lib/iosKeyboard.js`).
- El icon refresh en la home screen es impredecible.
- App Store tiende a rechazar progresivamente apps que parecen wrappers.
- Push (APNs) y pagos in-app van a empezar a ser dolorosos en Capacitor con el tiempo.

Una app en React Native nos da componentes reales (`<Text>`, `<View>`, `<ScrollView>`), gestos nativos (gesture-handler + reanimated 4), animaciones JIT y compatibilidad directa con el ecosistema iOS/Android moderno.

## 2. Qué se mantiene tal cual

- **Backend Supabase**: mismo proyecto, misma base de datos, mismas RLS policies, mismos triggers, mismos planes, mismas cuotas (`USAGE_LIMITS.md`), mismo tracking de costos (`AI_COST_TRACKING.md`).
- **Vercel APIs**: `/api/focus-assistant`, `/api/analyze-photo`, `/api/auth/email/send-otp`, `/api/calendar-feeds`, `/api/cron-notifications`, `/api/push`, `/api/kairos`, `/api/auth/delete-account` siguen siendo el único backend.
- **Privacidad** (`PRIVACY_AUDIT.md`, `PRIVACY_POLICY_DRAFT.md`): los flujos no cambian.
- **App Capacitor**: queda intacta como respaldo. `package.json` raíz, `vite.config.js`, `src/`, `ios/`, `capacitor.config.json` → todo sigue funcionando, sigue deployando a Vercel y a App Store via Capacitor mientras la app Expo no esté lista.
- **Tag de respaldo**: `capacitor-stable-before-expo` apunta al commit `be52600` (último estado estable Capacitor antes de empezar Expo).

## 3. Qué se creó nuevo

Carpeta hermana [`mobile/`](./mobile/) con un proyecto Expo SDK 54 (React Native 0.81, React 19, Expo Router 6).

```
mobile/
├── app/                 # rutas (Expo Router)
│   ├── _layout.tsx
│   ├── (auth)/{_layout,login}.tsx
│   └── (tabs)/{_layout,index,calendar,tasks,settings}.tsx
├── components/
│   ├── Screen.tsx
│   ├── haptic-tab.tsx        ← del template, render con Pressable nativo + haptic iOS
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   └── ui/icon-symbol.{tsx,ios.tsx}   ← SF Symbols nativos en iOS
├── constants/theme.ts
├── hooks/{use-color-scheme,use-theme-color}.ts
├── src/
│   ├── auth/AuthProvider.tsx
│   └── lib/{supabase,api}.ts
├── assets/images/            ← placeholders del template Expo (a reemplazar con assets de Focus)
├── app.json                  ← bundle id me.usefocus.app.expo
├── package.json
├── tsconfig.json
└── .env.example
```

Decisiones clave de la base inicial:

- **Expo Router** (file-based routing) en lugar de React Navigation puro. Más cercano a Next/Remix mentalmente y oficialmente recomendado por Expo SDK 54.
- **TypeScript** estricto desde el día 1 (`tsconfig.json` extiende `expo/tsconfig.base` con `strict: true`).
- **AsyncStorage** como adapter de persistencia para Supabase (recomendación oficial Supabase RN). `expo-secure-store` queda como upgrade futuro si queremos guardar el refresh token con encriptación de hardware.
- **Bundle ids distintos**:
  - Capacitor: `me.usefocus.app`
  - Expo: `me.usefocus.app.expo`

  → ambas apps pueden coexistir en el mismo iPhone durante el período de validación.
- **Sin monorepo formal** (workspaces, Turborepo, Nx). `mobile/` tiene su propio `package.json` y `node_modules/`. Es la opción más simple y nos deja libertad de evolucionar cada app a su ritmo.

## 4. Variables de entorno

La app Expo solo lee variables `EXPO_PUBLIC_*` (las únicas que se inyectan en el bundle del cliente). Los secrets backend (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, `APNS_PRIVATE_KEY`, `CRON_SECRET`) **no se replican**: viven solo en Vercel y se acceden vía `/api/*`.

| Variable web (Vite)        | Variable mobile (Expo)              |
| -------------------------- | ----------------------------------- |
| `VITE_SUPABASE_URL`        | `EXPO_PUBLIC_SUPABASE_URL`          |
| `VITE_SUPABASE_ANON_KEY`   | `EXPO_PUBLIC_SUPABASE_ANON_KEY`     |
| `VITE_API_ORIGIN`          | `EXPO_PUBLIC_API_ORIGIN`            |

Plantilla en [`mobile/.env.example`](./mobile/.env.example).

## 5. Estado de Supabase Auth en mobile

- Cliente Supabase configurado en [`mobile/src/lib/supabase.ts`](./mobile/src/lib/supabase.ts) con AsyncStorage adapter, PKCE, autoRefresh y refresh on `AppState === 'active'` (patrón oficial RN).
- `AuthProvider` ([`mobile/src/auth/AuthProvider.tsx`](./mobile/src/auth/AuthProvider.tsx)) expone `loading`, `ready`, `session`, `user`, `signOut`, `refresh`.
- `AuthGate` en `app/_layout.tsx` redirige automáticamente entre `(auth)/login` y `(tabs)`.
- Login OTP por correo: misma UX que la web, mismo endpoint Vercel (`POST /api/auth/email/send-otp`) → mismo Resend, mismo dominio, mismas tasas de entrega.
- Logout en **Ajustes** con confirmación + haptic.

Pendiente para fases siguientes:

- Google OAuth (Sign in with Apple primero porque Apple lo exige si hay otro OAuth)
- Delete account (`/api/auth/delete-account` ya existe en backend)

## 6. Estado de navegación

- 4 tabs nativos con `expo-router/Tabs`:
  - **Mi día** (`index.tsx`)
  - **Calendario** (`calendar.tsx`)
  - **Tareas** (`tasks.tsx`)
  - **Ajustes** (`settings.tsx`)
- `HapticTab` aplica `Haptics.impactAsync(Light)` en `onPressIn` (solo iOS).
- Iconos SF Symbols nativos via `expo-symbols` en iOS, fallback a `MaterialIcons` en Android/web.
- `Stack` para `(auth)` con `gestureEnabled: false` para evitar swipe-back accidental fuera del login.
- Colores de tab bar respetan el tema (claro/oscuro) automáticamente (`useColorScheme` del SO).

## 7. API client hacia Vercel

[`mobile/src/lib/api.ts`](./mobile/src/lib/api.ts) replica el contrato de [`src/lib/apiClient.js`](./src/lib/apiClient.js) de la web:

- Inyecta `Authorization: Bearer <access_token>` automáticamente leyendo la sesión Supabase actual.
- Timeout de 55s (alineado con `maxDuration: 60` de las funciones Vercel).
- Resuelve URLs relativas (`/api/...`) contra `EXPO_PUBLIC_API_ORIGIN`.
- Helper `sendOtp(email)` para el flujo de login.

Cuando agreguemos Mi día / Calendario / Tareas / Nova, todas las llamadas pasarán por `apiFetch()`.

## 8. Qué quedó intacto del lado Capacitor / web

- `package.json` raíz, `vite.config.js`, `src/`, `dist/` build pipeline.
- `capacitor.config.json` y carpeta `ios/` con el proyecto Xcode actual.
- Scripts: `npm run dev`, `npm run build`, `npm run ios:run`, `npm run ios:fresh`, `npm run ios:clean`.
- Hooks de build (`scripts/stamp-sw-version.mjs` para invalidar SW).
- Tests Playwright (`tests/`, `playwright.config.js`, `playwright.audit.config.js`).

Verificación manual recomendada: correr `npm run dev` en la raíz y abrir `http://localhost:5173` para confirmar que la web sigue funcionando idéntica.

## 9. Roadmap (fases siguientes)

1. **Assets de marca** — reemplazar `mobile/assets/images/icon.png` y `splash-icon.png` con los assets de Focus. Hacer iconos iOS adaptativos (light/dark/tinted en iOS 18).
2. **Mi día real** — leer `events` + `tasks` de Supabase, mismo modelo que la web (`src/hooks/useEvents.js`, `useTasks.js`).
3. **Calendario** — vista semanal y mensual con `react-native-calendars` o componente custom.
4. **Tareas** — drag-to-reorder con gesture-handler + reanimated, swipe-to-complete.
5. **Nova** — chat real contra `/api/focus-assistant`, con la misma UX de "Focus está pensando…".
6. **Push notifications** — Expo Notifications + token APNs registrado contra `/api/push`. La tabla `push_subscriptions` ya soporta tokens nativos junto a Web Push.
7. **Sign in with Apple** — obligatorio si agregamos Google OAuth.
8. **Delete account** — botón en Ajustes que llama `/api/auth/delete-account` (ya existe).
9. **App Store submission** con bundle id final (probablemente `me.usefocus.app` cuando jubilemos Capacitor; mientras tanto `me.usefocus.app.expo`).

## 10. Cómo volver a Capacitor si esto falla

```bash
git fetch origin --tags
git checkout capacitor-stable-before-expo   # snapshot del commit be52600
```

La carpeta `mobile/` puede borrarse sin afectar nada del lado Capacitor / web — son apps independientes que solo comparten backend.

## 11. Pruebas ejecutadas en Fase 0/1

Ver el commit que introduce esta migración:

- `npx tsc --noEmit` dentro de `mobile/` → typecheck OK
- `npm run lint` dentro de `mobile/` → lint OK
- `npm run build` raíz (web/Vite) → sigue compilando
- `expo start` arrancado para sanity check del bundler

La app no se probó todavía en iPhone físico — eso lo hace Martín siguiendo las instrucciones de [`mobile/README.md`](./mobile/README.md).

---

## Fase 2 — Datos reales básicos (in progress)

PR #8 mergeado a `main`. Esta fase agrega la primera capa de datos real desde Supabase y rehace las pantallas Mi Día / Tareas / Calendario para mostrar contenido del usuario autenticado.

### Capa de datos (`mobile/src/data/`)

| Archivo            | Responsabilidad                                                        |
| ------------------ | ---------------------------------------------------------------------- |
| `types.ts`         | Tipos TS de `Task`, `EventItem`, `TaskPriority`                        |
| `ids.ts`           | Generadores de IDs (`tsk-…`, `evt-…`) compatibles con la web           |
| `today.ts`         | Helpers de fecha (`todayISO`, `todayLabelLong`, `dateLabelShort`)      |
| `tasks.ts`         | `fetchTasks` · `createTask` · `setTaskDone` · `deleteTask`             |
| `events.ts`        | `fetchEvents` · `fetchEventsForDate` · `fetchTodayEvents`              |
| `useTasks.ts`      | Hook con `tasks/loading/error/refresh/addTask/toggleTask/removeTask`   |
| `useEvents.ts`     | Hook con `events/loading/error/refresh` y modo `'today' \| 'all'`      |

Decisiones simples para Fase 2 (no replicamos la complejidad de `src/services/dataService.js` web):

- **Sin caché en disco** todavía (la web usa `localStorage` con dedupe + pendingUpserts). En mobile arrancamos limpio y refrescamos al ganar foco con `useFocusEffect`. AsyncStorage queda para Fase 3.
- **Sin realtime subscription** todavía. `useFocusEffect` + pull-to-refresh cubren el 90% de los casos sin sumar la maquinaria de WebSocket que la web necesita por su modelo PWA.
- **Optimistic updates** en `toggleTask` / `removeTask` / `addTask`: la UI cambia al instante; si Supabase rechaza, revertimos. Sin esto el toggle se sentía laggy por la latencia de red.
- **RLS en defensa profunda**: aunque las policies `auth.uid() = user_id` ya garantizan acceso, todos los `update`/`delete` filtran `.eq('user_id', userId)` explícitamente. Patrón mismo que la web.

### Pantallas

- **Mi día** ([`app/(tabs)/index.tsx`](./mobile/app/(tabs)/index.tsx)): título grande + fecha localizada (es-CO), lista de eventos de hoy + lista de hasta 8 tareas pendientes. Pull-to-refresh refresca ambos. Estados loading / empty / error con `EmptyState` y `ErrorBanner`.
- **Tareas** ([`app/(tabs)/tasks.tsx`](./mobile/app/(tabs)/tasks.tsx)): input compositor sticky en la parte de arriba, lista en `FlatList` particionada en *Pendientes* / *Completadas*. Tap = toggle (haptic Light). Long-press = Alert de confirmación → delete (haptic Warning). Touch targets ≥48px. `KeyboardAvoidingView` para que el teclado iOS no tape el input.
- **Calendario** ([`app/(tabs)/calendar.tsx`](./mobile/app/(tabs)/calendar.tsx)): lista cronológica agrupada por fecha (hoy + futuro). `SectionHeader` con label localizado ("Hoy · jue 7 may"). Solo lectura en Fase 2 — crear/editar eventos vendrá con la pantalla detalle en Fase 3.
- **Ajustes** ([`app/(tabs)/settings.tsx`](./mobile/app/(tabs)/settings.tsx)): sin cambios — ya tenía email + versión + logout con confirmación + haptic Warning.

### Componentes nuevos

- `Screen` (heredado de Fase 1)
- `TaskRow`, `EventRow` — filas táctiles con haptics
- `SectionHeader` — separadores de sección estilo iOS
- `EmptyState`, `LoadingState`, `ErrorBanner` — estados utilitarios

### Tablas Supabase usadas

| Tabla         | Operaciones                          | RLS                     |
| ------------- | ------------------------------------ | ----------------------- |
| `tasks`       | SELECT, INSERT, UPDATE (done), DELETE | `auth.uid() = user_id` |
| `events`      | SELECT (filtrado por date)            | `auth.uid() = user_id` |

`user_profiles`, `suggestions`, `user_memories`, `user_signals`, `user_behavior` no se tocan en Fase 2.

### Mobile feel checks aplicados

- Componentes RN reales (`View`, `Text`, `Pressable`, `FlatList`, `ScrollView`, `RefreshControl`, `KeyboardAvoidingView`)
- SafeAreaView con edges `['top']` (la tab bar ya empuja el bottom)
- Touch targets ≥44px en TaskRow (`minHeight: 56`), addButton (`minHeight: 44`), input (`minHeight: 44`)
- Haptics: tab change (Light), task toggle (Light), task delete confirm (Warning), task create (Success), logout confirm (Warning)
- Pull-to-refresh nativo iOS (`RefreshControl`) en Mi Día, Tareas y Calendario
- KeyboardAvoidingView con `keyboardVerticalOffset` ajustado por la tab bar
- Sin WebView ni CSS web

### Cómo probar en iPhone

1. `cd mobile && cp .env.example .env` y completar con valores del proyecto Supabase
2. `npm run start`
3. Escanear QR con la cámara del iPhone (con [Expo Go](https://apps.apple.com/app/expo-go/id982107779) instalado)
4. Loguearse con tu correo (mismo OTP que la web)
5. Verificar:
   - **Mi día** muestra fecha de hoy + eventos del día (los que ya creaste desde la web aparecen)
   - **Tareas** lista las tareas reales; crear una desde el input la persiste a Supabase y aparece en la web tras refrescar
   - Tap en una tarea la marca como hecha (con haptic) y persiste
   - Long-press en una tarea pide confirmación y la borra
   - **Calendario** muestra eventos agrupados por fecha desde hoy en adelante
   - Pull-to-refresh en cualquier pantalla refresca al instante
   - **Ajustes** sigue mostrando tu email y permite cerrar sesión

### Qué falta para Fase 3

1. **Sincronización en vivo** — Supabase realtime channel sobre `tasks` y `events` (espejar `useTasks.js` web con coalesced refetch)
2. **Crear / editar eventos** desde mobile (botón "+" en Calendario y Mi Día)
3. **Pantalla detalle de tarea** (cambiar prioridad, categoría, descripción)
4. **Nova chat** contra `/api/focus-assistant`
5. **Push notifications** con Expo Notifications + APNs
6. **Sign in with Apple**
7. **Caché en disco con AsyncStorage** para pintado instantáneo offline
8. **Assets de marca** (icon.png y splash-icon.png siguen siendo placeholder Expo)
9. **Delete account** en Ajustes

## 9. Cómo correr la app nueva en Xcode

PR #9 dejó mergeado el proyecto Xcode generado por `npx expo prebuild -p ios`. Vive en [`mobile/ios/`](./mobile/ios/) y es **una app distinta** del Xcode legacy de Capacitor en [`ios/`](./ios/) (que sigue intacto y NO se debe tocar).

| Carpeta        | Origen                  | Bundle ID              | Cuándo abrirla                 |
| -------------- | ----------------------- | ---------------------- | ------------------------------ |
| `ios/`         | Capacitor (legacy)      | `me.usefocus.app`      | App actual en App Store        |
| `mobile/ios/`  | Expo prebuild (nuevo)   | `me.usefocus.app.expo` | App nueva — Xcode + simulador  |

### 9.1 Sincronizar main

```bash
git checkout main
git pull origin main
ls mobile/ios   # debe mostrar Focus, Focus.xcodeproj, Podfile
```

### 9.2 Asegurar CocoaPods (única vez)

CocoaPods 1.13+ es requerido por React Native 0.81 / Expo SDK 54 — porque podspecs como `react-native-safe-area-context` usan `s.visionos.deployment_target`, soportado solo desde pods 1.13.

La Ruby de macOS (`/usr/bin/ruby` 2.6.10) **no puede instalar CocoaPods 1.13+**. Cualquier intento de `gem install cocoapods` cae en una cadena de dependencias (`ffi`, `zeitwerk`, `securerandom`) que requieren Ruby ≥ 3.0. Verificado: hasta `cocoapods 1.11.3` se puede forzar, pero falla al parsear los podspecs modernos (`undefined method 'visionos'`).

**Forma recomendada — Homebrew** (trae su propia Ruby moderna):

```bash
# 1. Instalar Homebrew (pide tu contraseña una vez para crear /opt/homebrew):
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Después de instalar, si Apple Silicon, agregar brew al PATH del shell:
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# 3. Instalar CocoaPods:
brew install cocoapods

# 4. Verificar:
pod --version   # debe imprimir 1.16.x o superior
```

> Alternativa sin Homebrew: instalar Ruby 3+ con `rbenv` (tarda 30+ min compilando), luego `gem install cocoapods`. Evitar `sudo gem install cocoapods` — usa la Ruby vieja del sistema y rompe.

### 9.3 Instalar pods y abrir Xcode

```bash
cd mobile/ios
pod install            # genera Pods/ y Focus.xcworkspace
open Focus.xcworkspace # ← SIEMPRE el .xcworkspace, NUNCA el .xcodeproj
```

`pod install` tarda 2–5 min la primera vez (descarga Hermes, Folly, Boost, etc.).

### 9.4 Correr en Xcode

1. En Xcode, esquema **Focus** seleccionado (top bar izquierda).
2. Destino: **iPhone 15 Pro Simulator** (o tu iPhone físico si está conectado y confiado).
3. ▶ Run (Cmd+R).
4. Primera build: 5–10 min compilando Hermes y los nativos. Las siguientes: ~30s.

Si al correr en iPhone físico Xcode pide signing:
- **Targets → Focus → Signing & Capabilities**
- **Team**: tu Apple ID personal
- Bundle ID se queda en `me.usefocus.app.expo` (distinto del Capacitor)

### 9.5 Atajo: sin abrir Xcode

```bash
cd mobile
npm run ios   # equivale a `expo run:ios` — hace prebuild + pod install + build + launch
```

### 9.6 Verificación mínima en simulador

1. App abre con splash de Focus → cae en pantalla de login (si no hay sesión).
2. Login OTP: ingresar correo → llega código por Resend → verificar.
3. Mi Día carga con la fecha de hoy + eventos + tareas pendientes desde Supabase.
4. Tareas: crear, completar (haptic), borrar (long-press → Alert).
5. Calendario: lista cronológica desde hoy en adelante.
6. Ajustes: email visible + logout funciona.
7. Pull-to-refresh nativo en las 3 listas.
