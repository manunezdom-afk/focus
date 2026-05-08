# iOS — diagnóstico de arranque y warnings

> Última actualización: 2026-05-07.

Documento que cataloga los warnings que aparecen en Xcode al correr la app
y el flow de arranque (BootScreen + auth) para que cualquier asistente o
desarrollador entienda qué es normal y qué requiere acción.

## Workspace correcto

Solo abrir: `mobile/ios/Focus.xcworkspace`. **Nunca** `Focus.xcodeproj`
ni el `/ios` legacy de Capacitor (carpeta hermana al repo, no usar).

## Warnings que viste en Xcode

### 1. `'UIScene' lifecycle will soon be required. Failure to adopt will result in an assert in the future.`

**Qué es:** Apple está empujando a apps a migrar de
`UIApplicationDelegate` (estilo iOS 12) al modelo basado en Scenes (iOS
13+). El warning es una advertencia futura — eventualmente será assert.

**Causa en este proyecto:** `mobile/ios/Focus/AppDelegate.swift` lo genera
Expo SDK 54, y SDK 54 todavía usa el patrón `@UIApplicationMain` con
`UIWindow` directo. Adoptar Scenes requiere:
- `UIApplicationSceneManifest` en Info.plist
- Un `SceneDelegate` swift que reemplace parte de AppDelegate
- Cambios en `factory.startReactNative` para vivir dentro de la Scene

**Por qué NO lo migramos manualmente:** Expo Modules (camera, location,
etc.) instalados via `pod install` esperan el AppDelegate clásico. Si
mezclas, módulos pueden no recibir lifecycle events. La forma segura es
esperar a que Expo SDK 55+ adopte Scenes oficialmente. Apple ya señaló que
no será assert hasta iOS 19+, así que hay tiempo.

**Acción:** ignorar. No bloqueante. Re-evaluar cuando salga Expo SDK 55.

### 2. `empty dSYM file detected, dSYM was created with an executable with no debug info`

**Qué es:** Xcode esperaba símbolos de debug (.dSYM) en algún binario y
encontró el archivo vacío. Significa que ese pod/framework se compiló sin
debug info embedido.

**Causa típica:** Hermes (motor JS) o algún Pod se compila en Release con
DEBUG_INFORMATION_FORMAT = `dwarf` en vez de `dwarf-with-dsym`. En Debug
local de Xcode normalmente no genera dSYM y Hermes lo reporta vacío.

**Por qué NO bloquea:** la app corre normal. Solo afecta análisis de
crashes en producción (App Store Connect). Para builds de Release/TestFlight
hay que asegurar que Hermes y todos los Pods generen dSYM — eso normalmente
ya lo configura `expo prebuild` con `expo-build-properties`.

**Acción:** ignorar para development local. Si en futuro queremos dSYM
completo en Release, agregar al `app.json`:
```json
[
  "expo-build-properties",
  { "ios": { "deploymentTarget": "15.1", "useFrameworks": "static" } }
]
```
y re-correr `expo prebuild --clean && pod install`.

### 3. `_setUpFeatureFlags called with release level 2`

**Qué es:** print interno de UIKit / Foundation en iOS 18+ sobre flags
internos del runtime de Apple.

**Causa:** ninguna nuestra. Aparece en cualquier app iOS 18 que cargue
ciertos frameworks (UIKit, CoreFoundation).

**Acción:** ignorar. Es un log de Apple, no un warning del proyecto.

## Por qué la app inicia "raro" desde Xcode

### Flow de arranque (cold start)

```
1. iOS muestra LaunchScreen.storyboard (instant) — fondo #06080f + logo.
2. AppDelegate.application:didFinishLaunchingWithOptions: arranca RN.
3. RN bridge carga el bundle JS (en DEBUG: pide a Metro; en Release: lee
   main.jsbundle empacado).
4. JS empieza: _layout.tsx llama SplashScreen.preventAutoHideAsync().
   El splash nativo sigue arriba.
5. Shell.useEffect[]: SplashScreen.hideAsync() — el nativo se cae y el
   <BootScreen /> JS (overlay con mismo fondo + mismo logo) toma su lugar
   sin flicker visible.
6. AuthProvider corre supabase.auth.getSession() (lee AsyncStorage).
   ready=false → loading=true.
7. getSession resuelve: setState session=null|valid, loading=false, ready=true.
8. Shell.useEffect[ready]: cuando ready=true, espera el resto de
   BOOT_MIN_MS (900ms desde mount) y baja showBoot.
9. BootScreen sale con FadeOut(380ms).
10. AuthGate detecta ready=true:
    - si no hay session → router.replace('/(auth)/login')
    - si hay session → ya estamos en /(tabs) (anchor del unstable_settings)
```

**Tiempo total:** ~1.3 a 2s en cold start, dependiendo de cuánto tarde
Metro/JS y getSession.

### Posibles causas del "inicia raro"

- **Build & Run desde Xcode reinstala la app:** AsyncStorage persiste pero
  si Xcode hace "Erase Simulator Contents" se borra todo. En device físico,
  AsyncStorage sobrevive a reinstalls. Si te logueás una vez en device, no
  debería volver a pedir login al rebuildr.
- **Metro no listo cuando abre la app:** muestra red box "Could not
  connect to development server". Solución: dejar Metro corriendo
  (`npx expo start`) antes de Run.
- **Hot reload entre tabs interrumpiendo auth:** poco probable. Si pasa,
  cerrar Metro y rebuild fresco.

### Auth provider — comportamiento esperado

`mobile/src/auth/AuthProvider.tsx`:
- Llama `getSession()` UNA VEZ al mount.
- Suscribe a `onAuthStateChange` para refresh tokens automáticos y logout
  desde otra parte.
- `loading=false` y `ready=true` se setean recién cuando getSession
  resuelve. Antes de eso, BootScreen tapa todo — el usuario nunca ve
  "no autenticado" parpadear.

Si la sesión existe en AsyncStorage pero el token expiró:
- `getSession()` lo refresca automáticamente (`autoRefreshToken: true`).
- Si el refresh falla, devuelve `session: null` → AuthGate redirige a login.

## Si el problema persiste

Pasos de diagnóstico:
1. **Borrar app del device físico**, rebuilder desde Xcode → primera vez
   debería ir a /(auth)/login. Login normal. Cerrar app. Re-abrir
   → debería entrar directo a /(tabs) (sesión persistida).
2. Ver Metro logs (`npx expo start`): si hay errores rojos en JS, son
   los que rompen la app, no los warnings nativos.
3. En device físico: Settings → Focus → asegurar que tiene permisos de
   red activos (si la VPN del usuario o la red bloquea Supabase, getSession
   se cuelga indefinidamente).

## Resumen ejecutivo

| Síntoma | Causa | Acción |
|---------|-------|--------|
| Warning UIScene | Expo SDK 54 no migró aún | Ignorar |
| Empty dSYM | Hermes en Debug | Ignorar |
| _setUpFeatureFlags | Print de Apple | Ignorar |
| Pantalla en blanco al cambiar de tab | SwipeNavigator dejaba contenido off-screen | **Arreglado en commit que acompaña este doc** |
| App pide login después de Build & Run | Erase simulator o build fresh sin sesión previa | Normal — login una vez y persiste |

El único bug real fue el SwipeNavigator. Los warnings de Xcode son
inocuos para development.
