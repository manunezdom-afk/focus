# Subir build a TestFlight (Internal beta)

Hay 2 caminos: **Xcode local** (recomendado para el primer build, no requiere setup adicional) o **EAS Build** (más automatizable, requiere `eas-cli` y cuenta Expo conectada al Apple Developer team).

---

## Camino A — Xcode local (15-25 min cold)

### Pre-flight checklist
- [ ] `mobile/app.json` tiene `version` y `buildNumber` correctos. Para re-submits, bumpar al menos `buildNumber`.
- [ ] `mobile/ios/Focus/Info.plist` tiene los 4 NSUsageDescription (Camera, Photo, Microphone, SpeechRecognition).
- [ ] `mobile/ios/Focus/Info.plist` tiene `ITSAppUsesNonExemptEncryption=false` (cumplimiento export compliance).
- [ ] App Store Connect ya tiene la app creada con bundle id `me.usefocus.app.expo` (manual una sola vez en https://appstoreconnect.apple.com).
- [ ] iPhone NO conectado al Mac al momento del archive (Xcode requiere "Any iOS Device (arm64)" como destino para archive).

### Pasos exactos

1. **Abrir workspace** (NUNCA el .xcodeproj):
   ```
   open mobile/ios/Focus.xcworkspace
   ```

2. **Cambiar scheme a Release**:
   - Top bar → click en "Focus" (junto al ícono del simulador) → **Edit Scheme…** (⌘<).
   - Sidebar **Run** → tab **Info** → **Build Configuration**: cambiar a **`Release`**.
   - Cerrar.

3. **Cambiar destino a "Any iOS Device (arm64)"**:
   - Top bar device selector → **Any iOS Device (arm64)**.
   - (Si tu iPhone está conectado, desconéctalo primero. Archive no acepta device físico.)

4. **Archive**:
   - Menu **Product → Archive** (15-25 min la primera vez con Hermes JIT compilando todo el bundle).
   - Si Xcode pide credenciales del Apple Developer (D8UM897B2T): ingresarlas.

5. **Distribuir**:
   - Cuando termine el archive, Xcode abre **Organizer** automáticamente (si no: Window → Organizer).
   - Seleccionar el archive recién creado.
   - **Distribute App** → **App Store Connect** → **Upload** → **Next** (mantener defaults: include symbols, manage version + build number).
   - Esperar upload (~5-10 min según red).

6. **App Store Connect**:
   - Ir a https://appstoreconnect.apple.com → My Apps → focus-app → **TestFlight** tab.
   - El build aparecerá como "Processing" durante 10-30 min.
   - Cuando esté **Ready to Submit**:
     - Click el build → llenar "What to Test" (ej: "Beta interna primer build con Nova, dictado y notificaciones").
     - Para Internal Beta: NO requiere Privacy Policy URL, NO requiere App Review.
     - **Internal Testers**: agregar tu email de Apple ID. Recibirás invite a TestFlight app.

7. **Probar en iPhone**:
   - Abrir TestFlight app en el iPhone.
   - Aceptar invite (link en email).
   - Tap **Install** dentro de TestFlight.
   - Probar la build instalada.

### Si algo falla

| Error | Fix |
|---|---|
| `Cycle inside Focus` durante build | Product → Clean Build Folder (Cmd+Shift+K) → reintentar Archive. |
| `No signing certificate found` | Xcode → Settings → Accounts → Apple ID → Manage Certificates → "+" → Apple Distribution. |
| `Profile doesn't include certificate` | Apple Developer → Certificates, Identifiers & Profiles → regenerar provisioning profile. |
| `Bundle identifier already exists` | Confirmar que en App Store Connect la app tenga bundle id `me.usefocus.app.expo` — si no, registrar antes el bundle ID en Apple Developer dashboard. |
| `Invalid binary - missing icon` | Confirmar `mobile/assets/images/icon.png` es 1024×1024 PNG sin alpha. |
| `ITSAppUsesNonExemptEncryption missing` | Ya está en Info.plist como `false`. Si Xcode insiste, hacer clean + rebuild. |
| Build queda en "Processing" >1h | Apple suele tardar más en builds nuevos. Esperar. Si >24h: contactar Apple support. |

---

## Camino B — EAS Build (alternativa automática)

Solo viable si tenés `eas-cli` instalado y la cuenta de Expo está enlazada al team `D8UM897B2T`.

### Setup una sola vez
```bash
npm install -g eas-cli
cd mobile
eas login
eas build:configure  # solo si querés validar eas.json
```

### Build + submit
```bash
cd mobile
eas build --platform ios --profile production --non-interactive
# Genera el .ipa en cloud (~15 min). EAS te da una URL.

eas submit --platform ios --profile production --latest
# Sube el último build a App Store Connect.
# Requiere ascAppId en eas.json — buscarlo en App Store Connect después de crear la app por primera vez.
```

### Notas
- `eas.json` ya tiene perfiles `development`, `preview`, `production`.
- `ascAppId` está como placeholder en `eas.json`. Reemplazarlo con el App Store Connect App ID real (numérico, ej `1234567890`) que aparece en https://appstoreconnect.apple.com → My Apps → focus-app → App Information → "Apple ID".
- `appVersionSource: "remote"` significa que EAS gestiona buildNumber automáticamente — bumpa solo en App Store Connect.

---

## Bumpear versión

Para re-submit con cambios:
```
mobile/app.json
  "version": "0.1.1",       # bump si hay cambios visibles para el usuario
  "buildNumber": "2"         # bump SIEMPRE (cada submit, aunque sea hotfix)
```

Apple rechaza builds con buildNumber duplicado.

---

## Privacy Policy

**No requerida** para TestFlight Internal beta. **Sí requerida** para External beta y para release a App Store. Cuando llegue ese punto: usar `mobile/docs/PRIVACY_POLICY.md` (creado en Fase 5) como base, publicar en `https://www.usefocus.me/privacy`, y agregar la URL en App Store Connect → App Privacy.
