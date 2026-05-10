# Focus mobile (Expo)

App nativa de **Focus** en React Native + Expo Router. Vive dentro de este monorepo, junto a la app web (raíz del repo) y la app Capacitor (carpeta `ios/`). Comparte backend con ambas (Supabase, Vercel APIs).

> Estado: **Fase 2** — datos reales conectados. Auth por correo, Mi Día / Tareas / Calendario leen de Supabase, tareas se crean / completan / borran desde mobile. La lógica de Nova, push notifications y crear eventos vendrá en fases posteriores. Detalles y plan en [`MOBILE_EXPO_MIGRATION.md`](../MOBILE_EXPO_MIGRATION.md).

## Requisitos

- Node 20+ (en este repo se usa 24.14.1)
- npm 10+
- iOS: macOS con Xcode 15+ y los Command Line Tools instalados
- Cuenta Apple Developer si vas a probar en iPhone real
- (Opcional) [Expo Go](https://apps.apple.com/app/expo-go/id982107779) en el iPhone para iterar sin Xcode

## Setup

```bash
cd mobile
cp .env.example .env       # luego completa EXPO_PUBLIC_SUPABASE_*
npm install                # ya corrió tras `create-expo-app`, pero por si lo clonás de cero
```

## Variables de entorno

Solo se usan variables públicas (`EXPO_PUBLIC_*`), porque cualquier valor que llegue al bundle del cliente termina visible. Los secrets backend siguen viviendo solo en Vercel.

Ver [`.env.example`](./.env.example) — necesitás:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_ORIGIN` (default `https://www.usefocus.me`)

## Correr la app

### Expo Go (más rápido para iterar)

```bash
cd mobile
npm run start
# escanea el QR desde el iPhone con la cámara o con la app Expo Go
```

### Simulador iOS

```bash
cd mobile
npm run ios
# abre Xcode + iOS Simulator y bootea Focus
```

### iPhone físico via dev-build (cuando agreguemos módulos nativos no compatibles con Expo Go)

```bash
cd mobile
npx expo prebuild -p ios   # genera mobile/ios/
npx expo run:ios -d        # te deja elegir el dispositivo conectado
# o abre mobile/ios/*.xcworkspace en Xcode y corre desde ahí
```

## Estructura

```
mobile/
├── app/                      # rutas (Expo Router, file-based)
│   ├── _layout.tsx           # root: providers + AuthGate
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx         # email + OTP de 6 dígitos
│   └── (tabs)/
│       ├── _layout.tsx       # 4 tabs nativos con SF Symbols
│       ├── index.tsx         # Mi día
│       ├── calendar.tsx      # Calendario
│       ├── tasks.tsx         # Tareas
│       └── settings.tsx      # Ajustes (logout)
├── components/
│   ├── Screen.tsx            # wrapper común con SafeArea + título
│   ├── haptic-tab.tsx        # botón de tab con haptic en iOS
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   └── ui/icon-symbol.{tsx,ios.tsx}   # SF Symbols nativos en iOS
├── constants/theme.ts        # paleta Focus (light/dark)
├── hooks/                    # useColorScheme, useThemeColor
├── src/
│   ├── auth/AuthProvider.tsx # contexto de sesión Supabase
│   ├── data/                 # capa de datos hacia Supabase (Fase 2)
│   │   ├── types.ts          # Task, EventItem
│   │   ├── ids.ts            # generadores de IDs
│   │   ├── today.ts          # helpers de fecha local
│   │   ├── tasks.ts          # CRUD tareas
│   │   ├── events.ts         # queries eventos
│   │   ├── useTasks.ts       # hook con loading/error/refresh + optimistic
│   │   └── useEvents.ts      # hook con modo today/all
│   └── lib/
│       ├── supabase.ts       # cliente con AsyncStorage adapter
│       └── api.ts            # apiFetch con Bearer auto + sendOtp
├── assets/images/            # íconos generados por Expo (placeholder)
├── app.json                  # bundle id me.usefocus.app.expo
├── package.json
├── tsconfig.json
└── .env.example
```

## Auth

Mismo flujo OTP que la web:

1. El usuario escribe su correo → `POST /api/auth/email/send-otp` (endpoint Vercel ya existente).
2. Recibe un código de 6 dígitos por Resend.
3. La app llama `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
4. La sesión se persiste en AsyncStorage; `AuthProvider` la rehidrata al abrir la app.
5. `AuthGate` (en `app/_layout.tsx`) redirige a `/login` si no hay sesión y a `/(tabs)` cuando aparece.

Logout desde **Ajustes**.

Google OAuth y delete-account quedan para una fase siguiente.

## Convivencia con la app Capacitor

- La app Capacitor (`ios/`, `capacitor.config.json`, `src/`) sigue intacta y se sigue deployando como hasta ahora vía Vercel.
- Bundle id distinto (`me.usefocus.app.expo` vs `me.usefocus.app`) → ambas apps pueden estar instaladas a la vez en el mismo iPhone para A/B testing.
- Backend, RLS, planes, límites, tracking de costos: **iguales para ambas**.

## Comandos útiles

```bash
npm run start       # Expo dev server (QR + opciones)
npm run ios         # arranca + bootea simulador iOS
npm run android     # arranca + bootea emulador Android
npm run web         # versión web (no es nuestro target, pero sirve como sanity)
npm run lint        # eslint con la config Expo
npx tsc --noEmit    # typecheck (no hay script dedicado todavía)
```

## Próximos pasos

Ver [`MOBILE_EXPO_MIGRATION.md`](../MOBILE_EXPO_MIGRATION.md) para el roadmap completo. Lo más urgente:

- Iconos / splash de Focus (los actuales son los placeholders del template Expo)
- Pantalla Mi día con eventos + tareas reales
- Calendario semanal/mensual
- Nova (chat) con `/api/focus-assistant`
- Push notifications con Expo Notifications + APNs
