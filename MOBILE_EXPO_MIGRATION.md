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
