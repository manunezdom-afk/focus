# mobile/patches

Parches a `node_modules` aplicados automáticamente por
[`patch-package`](https://github.com/ds300/patch-package) en cada `npm install`
(via el script `postinstall` de `mobile/package.json`).

## Parches activos

### `expo+54.0.34.patch` — workaround temporal

**Versión afectada:** `expo` `54.0.34` (Expo SDK 54).
**Archivo:** `node_modules/expo/src/async-require/messageSocket.native.ts`

**Por qué existe:**
En Release builds, el archivo `messageSocket.native.ts` lanza
`Error: Cannot create devtools websocket connections in embedded environments`
durante la inicialización de la app. La condición que lo lanza está dentro
de `if (__DEV__)`, así que en teoría no debería ejecutarse en Release —
pero por algún mismatch del bundling de Expo SDK 54, el bundle Release
embebido está saliendo con `__DEV__=true`, y la app crashea antes de
montar React.

Síntoma exacto en el iPhone:
```
[runtime not ready]: Error: Cannot create devtools websocket connections
in embedded environments.
  at messageSocket.native.ts:12
  ...
```

**Qué hace el patch:**
Cambia el `throw new Error(...)` por `return null`, y envuelve el bloque
en `try/catch`. El `if (socket) socket.onmessage = ...` evita explotar
si no hay conexión. Resultado: la app NO crashea aunque `__DEV__` quede
mal puesto en el bundle.

**Por qué es temporal:**
La causa raíz es que `__DEV__` queda `true` en bundles Release. Eso es
un bug de bundling de Expo SDK 54 (o de la pipeline de `react-native-xcode.sh`).
Hay un pendiente técnico para investigarlo (ver TODO abajo). Cuando se
arregle upstream o cuando entendamos por qué el flag queda mal, este
parche se borra.

**Cómo removerlo cuando ya no haga falta:**

1. Verificar que el bug desapareció:
   ```bash
   cd mobile
   rm patches/expo+54.0.34.patch
   rm -rf node_modules
   npm install                     # debería NO aplicar ningún patch
   npx expo run:ios --configuration Release
   ```
2. Lanzar la app desde el iPhone físico (no simulator). Si abre sin el
   error de `messageSocket`, listo: el parche ya no es necesario.
3. Si sigue crasheando, restaurar el parche:
   ```bash
   git checkout patches/expo+54.0.34.patch
   ```

**TODO técnico (no urgente, no bloquea releases):**
Investigar por qué `__DEV__` queda `true` en el bundle Release. Ideas:
- ¿`react-native-xcode.sh` está recibiendo `DEV=true` mal por algún
  override de env var?
- ¿Algún plugin de Expo Router está corriendo Metro en dev mode incluso
  con `--configuration Release`?
- ¿Hay un cache stale del bundle (`.expo/cache`, `Library/Developer/Xcode/DerivedData/.../Build/Products/Release-iphoneos/main.jsbundle`)
  que sobrevive entre builds?
- ¿Probar con `expo export --platform ios` y embeber manualmente el
  bundle exportado en vez de dejar que `expo run:ios` lo bundle?

Cuando se resuelva, borrar este archivo y `expo+54.0.34.patch`.
