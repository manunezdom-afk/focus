# Focus — Setup iOS / TestFlight

Guía completa para correr **Focus** en un iPhone real desde Xcode y, después, subir una build a TestFlight.

---

## 1. Estado inicial encontrado

Al iniciar este setup, el proyecto **ya tenía toda la infraestructura iOS configurada**. No hubo que crear nada desde cero:

- Capacitor 8.3.1 instalado (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`)
- 6 plugins iOS instalados: `app`, `haptics`, `keyboard`, `push-notifications`, `splash-screen`, `status-bar`
- `capacitor.config.json` con `appId: me.usefocus.app`, `appName: Focus`, `webDir: dist`
- Carpeta `ios/App/` con `App.xcodeproj` y `CapApp-SPM/` (Swift Package Manager)
- `Info.plist` con permisos en español: micrófono, speech recognition, cámara, fotos, ubicación
- `App.entitlements` con `aps-environment` para push notifications
- `AppDelegate.swift` con hooks de push notifications y universal links wireados
- Build configs Debug/Release con `CODE_SIGN_STYLE = Automatic`
- Scripts npm: `ios:sync`, `ios:open`, `ios:run`, `build:ios-icons`

## 2. Lo que se configuró en este setup

**Nada se modificó** del código existente. El proyecto ya estaba listo. Lo único que se hizo fue:

1. `npm install` — confirmar dependencias al día (283 packages, 0 cambios)
2. `npm run build` — verificar que la app web builda (✓ 638 módulos en 2.06s)
3. `npx cap sync ios` — copiar `dist/` a `ios/App/App/public/` y actualizar plugins (✓ 0.062s)

Resultado: el proyecto iOS está sincronizado con la última build web.

## 3. Bundle ID y configuración clave

| Setting | Valor |
|---|---|
| App ID / Bundle ID | `me.usefocus.app` |
| App Name | Focus |
| Display Name | Focus |
| Marketing Version | 1.0 |
| Build (CFBundleVersion) | 1 |
| Deployment Target | iOS 15.0 |
| Devices | iPhone + iPad |
| Code Signing | Automatic |
| Push Notifications (Debug) | `aps-environment: development` |
| Push Notifications (Release) | `aps-environment: production` |
| Idioma base | Español (`es`) |

> **Nota Bundle ID**: el proyecto usa `me.usefocus.app` (coherente con el dominio de producción `usefocus.me`). No es `com.focusos.focus`. Si en App Store Connect aún no existe el App ID `me.usefocus.app`, hay que registrarlo antes de subir builds (paso 6).

## 4. Comandos ejecutados

```bash
# En /Users/martinnunezdominguez/Developer/focus/
git fetch origin main
git checkout -b feature/ios-testflight-setup

npm install
npm run build
npx cap sync ios
```

## 5. Cómo correr Focus en tu iPhone (paso a paso)

### 5.1 Abrir Xcode

```bash
cd /Users/martinnunezdominguez/Developer/focus
npx cap open ios
# o, equivalentemente: npm run ios:open
```

Xcode abre `ios/App/App.xcworkspace` (NO abrir el `.xcodeproj` directamente, siempre el workspace).

### 5.2 Seleccionar tu Apple Developer Team (primera vez)

1. En Xcode, panel izquierdo → click en **App** (el icono azul del proyecto, arriba de todo).
2. Pestaña **TARGETS** → seleccionar **App**.
3. Tab **Signing & Capabilities**.
4. Marca **Automatically manage signing** (si no está marcado).
5. En **Team**, abre el dropdown y elige tu equipo personal o de organización (el que ya tienes en Apple Developer).
6. Verifica:
   - **Bundle Identifier** = `me.usefocus.app`
   - **Provisioning Profile** = "Xcode Managed Profile" (lo crea solo)
   - **Signing Certificate** = "Apple Development: <tu-email>"
7. Si Xcode muestra un error rojo "Failed to register bundle identifier", significa que `me.usefocus.app` ya está registrado en otra cuenta o nunca se registró. Solución:
   - Ir a https://developer.apple.com/account/resources/identifiers/list
   - **Identifiers → +** → **App IDs → App** → Continue
   - Description: `Focus`, Bundle ID: Explicit `me.usefocus.app`
   - En Capabilities, marcar **Push Notifications**
   - Continue → Register
   - Volver a Xcode, click **Try Again** en el error.

### 5.3 Conectar tu iPhone

1. Conecta el iPhone con cable USB (Lightning o USB-C según modelo).
2. En el iPhone, si aparece "Confiar en este computador" → **Confiar** e introduce tu código de iPhone.
3. En la Mac, si pide permitir el accesorio → **Permitir**.
4. En Xcode, en la barra superior junto al botón ▶️, hay un selector de destino. Click ahí → debería aparecer tu iPhone bajo **iOS Device**. Selecciónalo.
   - Si tu iPhone aparece pero en gris con "preparing", espera 1–2 minutos a que Xcode termine de procesar símbolos (primera vez puede tardar).
   - Si no aparece: desconecta y reconecta el cable. En el iPhone, desbloquea la pantalla.

### 5.4 Habilitar Developer Mode en el iPhone (iOS 16+)

iOS 16 y posteriores requieren Developer Mode activado para correr apps desde Xcode:

1. Después del primer intento de Run desde Xcode, el iPhone te pedirá habilitar Developer Mode.
2. En el iPhone: **Ajustes → Privacidad y seguridad → Modo Desarrollador → Activar**.
3. El iPhone se reinicia. Después del reinicio, te pedirá confirmar → **Activar** y meter tu código.

### 5.5 Build & Run

1. En Xcode, con el iPhone seleccionado en el destino, presiona **Cmd+R** o el botón ▶️.
2. La primera vez tarda 1–3 min (compila plugins Capacitor, copia assets, firma la app).
3. Si aparece el error **"Untrusted Developer"** en el iPhone:
   - En el iPhone: **Ajustes → General → VPN y gestión de dispositivos → Apple Development: <tu-email> → Confiar**.
   - Volver a darle Run en Xcode.
4. Focus se instala y se abre.

### 5.6 Errores comunes y cómo resolverlos

| Error | Causa | Solución |
|---|---|---|
| "No account for team" | No agregaste tu Apple ID a Xcode | Xcode → Settings → Accounts → + → Apple ID, login |
| "Failed to register bundle identifier" | `me.usefocus.app` no está en tu cuenta de developer | Crear App ID en developer.apple.com (ver 5.2 paso 7) |
| "Could not launch — process launch failed: Security" | Developer Mode off | Activar Developer Mode (ver 5.4) |
| "Untrusted Developer" en iPhone | Profile sin confiar | Confiar el profile (ver 5.5 paso 3) |
| "Code signing is required for product type 'Application'" | Team no seleccionado | Seleccionar Team (ver 5.2) |
| "Capacitor: webDir 'dist' does not exist" | No corrió `npm run build` | `npm run ios:sync` |
| App abre en blanco | `dist/` desactualizado | `npm run ios:sync`, después Cmd+R |

## 6. Qué probar en el iPhone

Cuando Focus corre en el iPhone, prueba en este orden:

1. **Arranque inicial**
   - Splash screen con fondo `#0a0a0f` durante ~1.5s
   - StatusBar oscuro (icons claros)
2. **Login / Auth (Supabase)**
   - Magic link / OTP por email
   - Primera vez: tap en "Iniciar sesión" → ingresar email → recibir link → tap en el link abre Focus autenticado
3. **Navegación principal**
   - BottomNavBar con todas las tabs
   - Tap en cada tab no rompe la nav
4. **Calendario / Tareas**
   - Crear evento manualmente
   - Crear tarea
   - WheelTimePicker (verificar que el scroll funciona en iOS)
   - DayView, CalendarView
5. **Nova (asistente IA)**
   - Quick add por texto
   - Quick add por voz (mic permission)
   - Suggestions inbox
6. **Permisos iOS** (deben pedirse al primer uso)
   - Micrófono → al usar voice
   - Speech recognition → al usar voice
   - Cámara → al escanear QR / agenda en papel
   - Fotos → al usar Import desde fotos
   - Ubicación → al pedir contexto a Nova
   - Push notifications → al primer evento que los requiera
7. **Push notifications**
   - Permitir en el primer prompt
   - Verificar que recibes el push de prueba (cron-notifications.js dispara cada hora — para test inmediato, hay que disparar manualmente desde el backend)
8. **Safe area / Layout**
   - Notch no tapa el header
   - BottomNavBar no se mete bajo la home indicator
   - Inputs no quedan tapados por el teclado al focusear
9. **Teclado**
   - Aparece y desaparece sin glitches
   - Inputs hacen scroll automático cuando el teclado los tapa
10. **Performance**
    - Animaciones fluidas (60fps)
    - Scrolls suaves
    - No memory warnings en Xcode console

## 7. Cómo hacer sync después de cambios en el código

Cada vez que cambies código React/JSX, repite:

```bash
cd /Users/martinnunezdominguez/Developer/focus
npm run ios:sync
# Equivalente a: npm run build && npx cap sync ios
```

Después, en Xcode → Cmd+R.

Si solo cambiaste código nativo en `ios/`, basta con Cmd+R en Xcode (sin `cap sync`).

## 8. Preparar build para TestFlight

> ⚠️ **No subas builds sin estar 100% seguro**. Cada upload incrementa el build number en App Store Connect y queda registrado.

### 8.1 Pre-requisitos en App Store Connect

Antes de subir la primera build, asegúrate de tener en https://appstoreconnect.apple.com:

1. **App creada**:
   - **My Apps → +** → **New App**
   - Platform: iOS
   - Name: Focus
   - Primary language: Spanish (Spain) o el que prefieras
   - Bundle ID: seleccionar `me.usefocus.app` (debe estar registrado primero en developer.apple.com — ver paso 5.2.7)
   - SKU: `focus-ios-001` (cualquier identificador único interno)
   - User Access: Full Access
2. **Información de la app** (puedes completar después de la primera build):
   - Privacy policy URL (obligatorio para TestFlight externo)
   - Categoría: Productivity
   - Iconos (1024x1024 sin transparencia)
3. **TestFlight**:
   - Internal Testing: agregar tu Apple ID al equipo de testers internos
   - External Testing: opcional al inicio, requiere review de Apple

### 8.2 Subir build (Archive + Upload)

1. **Bumpear build number** (cada upload necesita uno nuevo):
   - En Xcode → App target → tab General → **Build** = 2 (o el siguiente).
   - O por CLI antes de archive:
     ```bash
     cd /Users/martinnunezdominguez/Developer/focus/ios/App
     xcrun agvtool new-version -all 2
     ```
2. **Sincronizar últimos cambios**:
   ```bash
   cd /Users/martinnunezdominguez/Developer/focus
   npm run ios:sync
   ```
3. **Seleccionar destino "Any iOS Device"** en Xcode (NO un simulador, NO tu iPhone — necesita ser arch ARM genérico para archivar).
4. **Archive**: menú **Product → Archive**.
   - Tarda 3–5 min la primera vez.
   - Si falla con "Code signing", revisa que tu Team esté seleccionado y el provisioning profile sea válido.
5. Cuando termina, abre **Organizer** automáticamente.
6. **Distribute App**:
   - Selecciona el archive recién creado.
   - Click **Distribute App**.
   - Method: **App Store Connect** → Next.
   - Destination: **Upload** → Next.
   - Re-sign: **Automatically manage signing** → Next.
   - Review summary → **Upload**.
7. Apple pide login con tu Apple ID + 2FA.
   - **Si te pide login y no estás seguro, frena. Confirma conmigo antes**.
8. Upload tarda 5–15 min.
9. En App Store Connect → My Apps → Focus → TestFlight, la build aparece en estado **Processing** (10–30 min) y después **Ready to Test**.
10. **Antes** de que aparezca como "Ready to Test", App Store Connect te pide responder el cuestionario de Export Compliance:
    - Pregunta: ¿usa criptografía? → Sí (HTTPS estándar) → Pero exempt por usar solo HTTPS estándar / SDK Apple → marcar exemption.
11. Una vez "Ready to Test", agregas testers internos y reciben el invite por email.

### 8.3 Pendientes antes de subir tu primera build a TestFlight

- [ ] Confirmar que `me.usefocus.app` esté registrado en developer.apple.com como App ID con Push Notifications habilitado.
- [ ] Crear la app en App Store Connect (Bundle ID: `me.usefocus.app`).
- [ ] Subir un icono 1024x1024 (sin transparencia, sin canal alpha) en App Store Connect.
- [ ] Tener una privacy policy publicada (puedes apuntar a `https://usefocus.me/privacy` si existe).
- [ ] Configurar Info Plist con las descripciones de uso de cada permiso (✓ ya está hecho en español).
- [ ] Subir un screenshot por tamaño requerido (no requerido para TestFlight Internal, sí para External y App Store).
- [ ] Agregar tu Apple ID como Internal Tester en App Store Connect → TestFlight → Internal Testing.

## 9. Cómo subir una nueva build después

```bash
# 1. Trabaja en una rama feature, mergea a main
git checkout main && git pull
git checkout -b feature/<algo>
# ... cambios ...
git add <archivos-específicos>
git commit -m "feat: ..."
git push origin feature/<algo>
# Mergear PR a main

# 2. Volver a main y sync iOS
git checkout main && git pull
cd /Users/martinnunezdominguez/Developer/focus
npm run ios:sync

# 3. En Xcode: bump build number, Archive, Upload
# (paso 8.2 a partir del punto 1)
```

Las builds en TestFlight Internal salen sin review. Las builds para External Testers (más de 100 testers, sin Apple ID) sí pasan por review (~24h).

## 10. Lo que NO se hizo en este setup

Para mantener el alcance acotado y no romper nada:

- ❌ **No se cambió el Bundle ID** (sigue siendo `me.usefocus.app`).
- ❌ **No se hardcodeó DEVELOPMENT_TEAM** en `project.pbxproj` (cada developer lo selecciona en su Xcode local; queda en `xcuserdata/` que está gitignored).
- ❌ **No se subió ninguna build a App Store Connect**.
- ❌ **No se publicó nada** en App Store ni TestFlight.
- ❌ **No se modificaron iconos** ni assets (si necesitas regenerar iconos iOS: `npm run build:ios-icons`).
- ❌ **No se tocó código fuente** de la app (React/JSX/CSS).

## 11. Checklist final

Antes de cerrar el setup, verifica:

- [ ] `npm run build` completa sin errores.
- [ ] `npx cap sync ios` completa sin errores.
- [ ] `npx cap open ios` abre Xcode correctamente.
- [ ] En Xcode, Signing & Capabilities muestra tu Team y "Xcode Managed Profile".
- [ ] Build (Cmd+B) en Xcode pasa sin errores.
- [ ] Run (Cmd+R) en Simulador funciona (al menos splash screen).
- [ ] Run (Cmd+R) en iPhone real funciona.
- [ ] La app abre y muestra la UI principal (no pantalla blanca).

Si todos los checks pasan, el proyecto está listo para iterar y eventualmente hacer Archive + Upload a TestFlight cuando decidas.

---

**Última actualización**: 2026-05-04
**Branch**: `feature/ios-testflight-setup`
**Versión Capacitor**: 8.3.1
**Bundle ID**: `me.usefocus.app`
