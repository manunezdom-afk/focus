# Focus — protocolo de trabajo en paralelo (Claude × Codex)

Este proyecto se edita con **dos asistentes en paralelo** (Claude Code y Codex). Ambos pushean a `main` y `main` es lo que Vercel deploya a producción (usefocus.me). Para que los cambios de uno NO pisen los del otro, seguir este protocolo sin excepción.

## Antes de empezar a editar archivos

1. `git fetch origin main`
2. `git rebase origin/main` (si la rama actual no es `main`)
3. Solo entonces leer/editar.

Si rebase tira conflictos: parar, mostrar el conflicto al usuario, resolverlo con su input. **Nunca** descartar los cambios del otro asistente como atajo (`git checkout --theirs`/`--ours` ciego, `git reset --hard`, etc.).

## Después de commitear

1. `git add <archivos-específicos>` — **nunca** `git add .` ni `git add -A`. El otro asistente puede tener cambios in-flight en otros archivos.
2. `git commit -m "..."`
3. `git fetch origin main && git rebase origin/main` (por si llegaron commits nuevos mientras editabas).
4. `git push origin HEAD:main` (fast-forward push directo a main).

Si el push es rechazado por non-fast-forward: repetir paso 3 y reintentar. Nunca usar `--force` ni `--force-with-lease` sobre `main`.

## Reglas firmes

- **PROHIBIDO `git push --force`/`-f` a main.** Borra los commits del otro asistente sin aviso.
- **PROHIBIDO `git reset --hard`** sin verificar `git status` y `git log` primero.
- **PROHIBIDO** stagear archivos que no tocaste en esta sesión. Si aparecen modificados de otro lado, dejarlos.
- `.claude/settings.local.json` y similares: nunca commitear, son locales.
- Para cambios riesgosos (deps, schema DB, refactor grande) → rama feature + PR, no push directo.

## Vercel + caches

- Solo `main` → producción. Ramas no deployan (salvo preview).
- `scripts/stamp-sw-version.mjs` corre en cada `vite build` y bumpa el `VERSION` del service worker con el commit SHA → caches viejos del SW se invalidan automáticamente.
- Cuando cambien archivos en `public/icons/` (favicon, apple-touch-icon, icon-192/512): bumpar el query string `?v=N` en `index.html` y `public/manifest.json` para forzar cache-bust del browser HTTP.
- iOS instalado en home screen NUNCA refresca su icono. El usuario debe desinstalar (long-press → eliminar) y reinstalar desde Safari → Compartir → Añadir a pantalla de inicio.

## Estructura del repo (2026-05-10)

| Carpeta | Qué es | Tocar |
|---|---|---|
| `/src`, `/public`, `/api`, `vercel.json` | App web + APIs Vercel → producción `usefocus.me` | Con cuidado |
| `/supabase` | Migraciones + schema DB | Solo con migraciones nuevas |
| `/ios-native` | **App iOS nativa Swift/SwiftUI — fuente de verdad mobile** | Aquí va el trabajo mobile |
| `/legacy-capacitor-ios` | Viejo wrapper Capacitor iOS (archivado) | No tocar |
| `/legacy-expo` | Vieja app Expo/React Native (archivada) | No tocar |

Ver `IOS_NATIVE_MIGRATION.md` para el plan completo de la app nativa.

## Mobile builds — iOS Nativo (Swift/SwiftUI)

La nueva app iOS nativa vive en `/ios-native/Focus.xcodeproj`.

Para abrir en Xcode:
```bash
npm run native:ios:open
# o bien:
open ios-native/Focus.xcodeproj
```

Build desde terminal (simulador):
```bash
xcodebuild -scheme Focus -destination "platform=iOS Simulator,name=iPhone 17,OS=26.4.1" -configuration Debug build
```

- **Bundle ID**: `me.usefocus.app`
- **Team**: `D8UM897B2T`
- **Deploy target**: iOS 17.0
- **No tiene Pods ni SPM packages todavía** (Fase 1 pura SwiftUI)

## Mobile builds legacy — Expo (archivado)

Los builds Expo del viejo `legacy-expo/` se hacen desde `~/Developer/focus-expo-xcode-test/mobile/` si alguna vez se necesitan como referencia. No correr desde el worktree (no tiene `node_modules`).

## Idioma de copy

Toda copy visible al usuario va en **español neutral** (forma "tú"), nunca voseo argentino. Aplica a títulos, mensajes, empty states, errores, copy de Nova, notificaciones push y system prompts.

**Prohibido:** vos, tenés, sos, querés, podés, movelas, dormí, disfrutá, metés, agendá, tocás, abrís, hacelo, fijate, escribí, pensá, andá, mirá, decime, ponete.

**Usar en su lugar:** tú/te, tienes, eres, quieres, puedes, muévelas, duerme, disfruta, métela, agenda, tocas, abres, hazlo, fíjate, escribe, piensa, ve, mira, dime, ponte.

Antes de commitear copy nueva, hacer grep por: `vos|tenés|sos|querés|podés|movelas|dormí|disfrutá`. Comentarios internos del código (no visibles al usuario) pueden ir en cualquier dialecto.

## Memoria entre asistentes

- `CLAUDE.md` (este archivo) lo lee Claude Code automáticamente al inicio de cada sesión.
- `AGENTS.md` es una copia con el mismo contenido para Codex y otros agentes que sigan esa convención.
- Si actualizás uno, actualizá el otro.
