# Focus iOS Native — Plan de Migración

**Decisión**: Focus mobile pasa de Expo/React Native a una app iOS nativa en Swift/SwiftUI.  
**Motivo**: la experiencia actual siente lag en gestos, animaciones y respuesta táctil. iOS nativo garantiza 60/120 fps real, acceso directo a UIKit/SwiftUI, y una experiencia premium de iPhone que no se puede lograr con un bridge JS.

---

## Estado actual del repositorio

| Carpeta | Qué es | Estado |
|---|---|---|
| `/src` | App web React/Vite — produce `usefocus.me` | **Producción activa** |
| `/public` | Assets web (icons, SW, manifest) | **Producción activa** |
| `/api` | Serverless functions Vercel (Nova, auth, push, transcribe…) | **Producción activa — no tocar** |
| `/supabase` | Migraciones y schema de la base de datos | **Producción activa — no tocar** |
| `/ios-native` | **Nueva app iOS nativa Swift/SwiftUI** | **Fuente de verdad mobile** |
| `/legacy-capacitor-ios` | Viejo proyecto Capacitor (wrapper web → iOS) | Legacy, solo referencia |
| `/legacy-expo` | Vieja app Expo/React Native | Legacy, solo referencia |
| `/tests` | Tests unitarios y e2e del backend/web | Mantener |
| `/docs` | Documentación técnica | Mantener |
| `/scripts` | Build scripts (SW versioning, icons) | Mantener |

---

## Por qué Swift/SwiftUI

- **Performance real**: sin bridge JS ni overhead de React Native. Gestos a 60/120fps nativos.
- **Adopción Apple**: SwiftUI es el stack oficial de Apple para app nuevas en iOS 17+.
- **Acceso completo a APIs**: `UIKit`, `AVFoundation`, `EventKit`, `HealthKit`, `CoreData`, `NaturalLanguage` — todo sin plugins de terceros.
- **Separación limpia**: el backend REST (Vercel + Supabase) es agnóstico del cliente. La app nativa simplemente llama los mismos endpoints.
- **Mantenimiento**: un solo codebase Swift en vez de tres (web + Capacitor + Expo).

---

## Arquitectura objetivo

```
ios-native/
  Focus.xcodeproj/         ← abrir en Xcode
  Focus/
    FocusApp.swift         ← @main, WindowGroup
    ContentView.swift      ← boot splash → home router
    Views/
      BootView.swift       ← splash animado (~1.8s)
      HomeView.swift       ← "Mi Día" placeholder (Fase 1)
      [Fase 2+]
        AuthView.swift
        PlannerView.swift
        NovaView.swift
        CalendarView.swift
        TasksView.swift
        SettingsView.swift
    Models/                ← tipos Swift (Task, Event, UserPlan…)
    Services/
      APIClient.swift      ← URLSession → Vercel APIs
      SupabaseClient.swift ← supabase-swift SDK
      AuthService.swift    ← sesión Supabase
    Shared/
      Theme.swift          ← colores, tipografías, radios
      Extensions.swift
```

---

## Backend: sin cambios

El backend actual es independiente del cliente. La app iOS nativa consume exactamente los mismos endpoints:

| Endpoint | Uso en iOS nativo |
|---|---|
| `POST /api/focus-assistant` | Nova (chat AI) |
| `POST /api/transcribe` | Dictado de voz |
| `POST /api/analyze-photo` | Foto → evento |
| `GET /api/me` | Perfil + plan del usuario |
| `POST /api/push` | Registro de token APNS |
| `GET /api/calendar-feeds` | Feeds iCal |
| Supabase directo | Tasks, events, memories, user_plans, ai_usage |

**Bundle ID para Supabase Auth redirect**: `me.usefocus.app`  
**Apple Team**: `D8UM897B2T`

---

## Cómo abrir el proyecto en Xcode

```bash
# Desde la raíz del repo:
npm run native:ios:open
# o directamente:
open ios-native/Focus.xcodeproj
```

1. Xcode abrirá el proyecto `Focus`.
2. Seleccionar target `Focus` → Signing & Capabilities → Team: Martin Nuñez / `D8UM897B2T`.
3. Seleccionar un simulador (iPhone 17) o conectar iPhone físico.
4. ⌘R para correr.

### Nota de signing en primer arranque

Si Xcode muestra error de signing:
- Target: `Focus`  
- Pantalla: Signing & Capabilities  
- Acción: seleccionar tu Apple Team en el dropdown "Team"
- El `PRODUCT_BUNDLE_IDENTIFIER = me.usefocus.app` ya está configurado.

---

## Fase 1 — completada ✓

- [x] Estructura del repositorio ordenada
- [x] `legacy-capacitor-ios/` y `legacy-expo/` claramente etiquetados
- [x] Proyecto `ios-native/Focus.xcodeproj` creado y compila sin errores
- [x] Boot screen animado (logo + tagline)
- [x] Home screen "Mi Día" en estado placeholder
- [x] Bundle ID `me.usefocus.app` configurado
- [x] Development Team `D8UM897B2T` configurado
- [x] Deploy target iOS 17.0
- [x] Script `npm run native:ios:open` para abrir desde terminal

---

## Fase 2 — siguiente

1. **Autenticación**: integrar `supabase-swift` con Auth email/password + Magic Link. Redirigir a `me.usefocus.app://callback`.
2. **Mi Día real**: fetch de tasks + events de Supabase. Timeline nativo con `List` / `ScrollView` custom.
3. **Nova**: chat con `URLSession` llamando `/api/focus-assistant`. Input bar nativa con dictado.
4. **Calendario**: EventKit para calendario local + feeds iCal.
5. **Push notifications**: registro APNS token → `/api/push`.
6. **Configuración**: plan, memorias, preferencias de Nova.
7. **TestFlight**: EAS replaced por Xcode Archive → App Store Connect.

---

## Qué NO tocar sin cuidado

- `/supabase/migrations/` — migraciones aplicadas en producción; nunca borrar ni revertir sin coordinación.
- `/api/` — endpoints en producción; cambiar con cuidado y versionado.
- `vercel.json` — configuración del deploy web; no modificar sin testing.
- `.github/workflows/` — cron de notificaciones push; requiere secrets configurados.
- RLS policies — están en las migraciones y en Supabase dashboard; revisar antes de cualquier cambio de schema.

---

## Riesgos detectados

| Riesgo | Severidad | Mitigación |
|---|---|---|
| `me.usefocus.app` usado por Capacitor legacy | Baja | Capacitor está archivado; el bundle ID queda libre para el nativo |
| supabase-swift OAuth redirect | Media | Configurar URL scheme `me.usefocus.app` en Info.plist en Fase 2 |
| TestFlight pipeline nuevo | Media | Reemplaza EAS; requiere App Store Connect + certificados frescos |
| `legacy-expo/` sin mantenimiento | Baja | Solo referencia; no se buildea ni deploya |

---

_Creado: 2026-05-10 | Fase 1 completada por Claude (Senior iOS Engineer mode)_
