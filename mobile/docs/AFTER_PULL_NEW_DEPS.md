# Después de pullear cambios con dependencias nuevas

Si este pull agregó dependencias nativas (cualquier `expo-*` que termine en
"-native" o que toque módulos UIKit/Foundation), tenés que correr local:

```bash
cd mobile
npm install                     # o yarn / pnpm — lo que use el proyecto
npx expo install --check        # alinea versiones al SDK actual (54.x)
cd ios
pod install                     # linkea pods de las nuevas deps
cd ../..
# Después abrir Xcode y correr Build & Run
```

Sin esos pasos, el build de Xcode tira errores de "module not found" para
módulos como `ExpoImagePicker`, `ExpoImageManipulator`, etc.

## Cambios recientes que requieren esto

### `feat(mobile): camera + memorias action` (2026-05-07)

- `expo-image-picker` y `expo-image-manipulator` agregadas para que Nova
  analice fotos de agenda.
- Permisos `NSCameraUsageDescription` y `NSPhotoLibraryUsageDescription`
  agregados a `Info.plist`.

Después de pullear:
1. `npm install`
2. `cd ios && pod install`
3. Build & Run en Xcode.
4. Primera vez que tocas el botón cámara en Nova, iOS pide permiso. Una
   sola vez por permiso.

## Tip

Cuando Xcode muestra rojo "module not found" después de pull, el 90% de
las veces es esto. Si después de `pod install` sigue rojo, hacer
`Product → Clean Build Folder` (Cmd+Shift+K) y rebuild.
