# Reglas para agentes IA en Focus

> Versión 2026-05-26. Reglas nuevas arriba, protocolo Claude × Codex preservado abajo.

## 0. Estado actual del repo (lee esto primero)

| Item | Valor |
|---|---|
| **Rama estable** (producción Vercel `usefocus.me`) | `main` |
| **Rama de trabajo autorizada** | `focus-os-dev` (creada desde `origin/main` el 2026-05-26) |
| **Carpeta de trabajo principal** | `/Users/martinnunezdominguez/Developer/focus` |
| **Fuente de verdad iOS** | `/ios-native/Focus.xcodeproj` (Swift/SwiftUI nativo) |
| **Worktree con `mobile/.env` para builds Expo legacy** | `/Users/martinnunezdominguez/Developer/focus-expo-xcode-test` (checked-out en `main`) |
| **Remoto** | `origin = https://github.com/manunezdom-afk/focus.git` |

---

## 1. Antes de tocar código, siempre ejecutar

```bash
pwd
git status
git branch --show-current
git remote -v
```

Si cualquiera de esos comandos da un resultado inesperado: **detente y reporta** antes de seguir.

## 2. No trabajar si no estás en la carpeta correcta

Path requerido:

```
/Users/martinnunezdominguez/Developer/focus
```

Si estás en otro path (`focus-expo-xcode-test`, `.claude/worktrees/*`, `spark`, `kairos`, etc.): detente y pregunta al usuario.

## 3. Fuente de verdad iOS

```
/ios-native/
```

App iOS nativa Swift/SwiftUI. Bundle `me.usefocus.app`, Team `D8UM897B2T`, iOS 17.0+. Sin Pods ni SPM packages activos (fase pura SwiftUI). Plan: `IOS_NATIVE_MIGRATION.md`.

## 4. No trabajar en `/mobile/` ni `/ios/` salvo autorización explícita

- En `main` esas carpetas se llaman `legacy-expo/` y `legacy-capacitor-ios/` (solo referencia histórica).
- Si las ves como `/mobile/` o `/ios/` en tu working tree: estás en una rama vieja. No edites ahí.
- Todo trabajo mobile va en `/ios-native/`.

## 5. No crear ramas nuevas sin autorización explícita del usuario

- Default: trabajar en `focus-os-dev`.
- No crear ramas `claude/*`, `codex/*`, `feature/*`, `fix/*` ni equivalentes sin OK directo.
- Hotfix sobre `main`: pedir permiso primero.

## 6. Antes de empezar cambios

```bash
git fetch origin
git pull --ff-only origin main   # sincronizar focus-os-dev con main
```

Si el fast-forward falla (`focus-os-dev` y `main` divergieron): **detente y avisa**, no hagas merge/rebase a ciegas.

## 7. Después de cambios relevantes

1. Mostrar archivos modificados: `git status`, `git diff --stat`.
2. Correr build/test si aplica al área tocada.
3. Stagear específicamente:
   ```bash
   git add path/al/archivo1 path/al/archivo2     # NUNCA git add -A ni git add .
   ```
4. Commit descriptivo: `git commit -m "tipo(scope): descripción"`.
5. Push a la rama autorizada:
   ```bash
   git push origin focus-os-dev
   ```

## 8. Nunca dejar cambios importantes solo en local sin avisar

Si terminás una sesión con commits sin push o cambios sin commit: avisar al usuario explícitamente antes de cerrar.

## 9. Nunca mezclar Focus iOS con Focus web si son carpetas distintas

- `/src/`, `/public/`, `/api/`, `/supabase/`, `vercel.json` → web (Vercel)
- `/ios-native/` → iOS nativo Swift
- Commits independientes por dominio cuando se pueda.

## 10. Si hay conflicto entre ramas o carpetas, detenerse y explicar antes de tocar

Aplica a:
- Conflictos de merge/rebase.
- Ramas duplicadas (`codex/...`, `feature/...`, `claude/...` vs `focus-os-dev` vs `main`).
- Carpetas duplicadas (`ios/` vs `ios-native/`, `mobile/` vs `legacy-expo/`).
- Worktrees no esperados (cualquier path bajo `.claude/worktrees/` o fuera de `/Users/martinnunezdominguez/Developer/focus`).

---

# Reglas heredadas del protocolo Claude × Codex (preservadas)

## Antes de editar (versión completa de rebase)

1. `git fetch origin main`
2. `git rebase origin/main` (si la rama actual no es `main`)
3. Solo entonces leer/editar.

Si rebase tira conflictos: parar, mostrar el conflicto al usuario, resolverlo con su input. **Nunca** descartar los cambios del otro asistente como atajo (`git checkout --theirs`/`--ours` ciego, `git reset --hard`, etc.).

## Reglas firmes de git

- **PROHIBIDO `git push --force`/`-f` a `main` o a `focus-os-dev`.** Borra los commits del otro asistente sin aviso.
- **PROHIBIDO `git reset --hard`** sin verificar `git status` y `git log` primero.
- **PROHIBIDO** stagear archivos que no tocaste en esta sesión. Si aparecen modificados de otro lado, dejarlos.
- `.claude/settings.local.json` y similares: nunca commitear, son locales.
- Para cambios riesgosos (deps, schema DB, refactor grande) → rama feature + PR con autorización, no push directo.

## Vercel + caches

- Solo `main` → producción. Ramas no deployan (salvo preview).
- `scripts/stamp-sw-version.mjs` corre en cada `vite build` y bumpa el `VERSION` del service worker con el commit SHA → caches viejos del SW se invalidan automáticamente.
- Cuando cambien archivos en `public/icons/` (favicon, apple-touch-icon, icon-192/512): bumpar el query string `?v=N` en `index.html` y `public/manifest.json` para forzar cache-bust del browser HTTP.
- iOS instalado en home screen NUNCA refresca su icono. El usuario debe desinstalar (long-press → eliminar) y reinstalar desde Safari → Compartir → Añadir a pantalla de inicio.

## Estructura del repo

| Carpeta | Qué es | Tocar |
|---|---|---|
| `/src`, `/public`, `/api`, `vercel.json` | App web + APIs Vercel → producción `usefocus.me` | Con cuidado |
| `/supabase` | Migraciones + schema DB | Solo con migraciones nuevas |
| `/ios-native` | **App iOS nativa Swift/SwiftUI — fuente de verdad mobile** | Aquí va el trabajo mobile |
| `/legacy-capacitor-ios` | Viejo wrapper Capacitor iOS (archivado) | No tocar |
| `/legacy-expo` | Vieja app Expo/React Native (archivada) | No tocar |

## Mobile builds — iOS Nativo (Swift/SwiftUI)

Abrir en Xcode:
```bash
npm run native:ios:open
# o:
open ios-native/Focus.xcodeproj
```

Build desde terminal (simulador):
```bash
xcodebuild -scheme Focus \
  -destination "platform=iOS Simulator,name=iPhone 17,OS=26.4.1" \
  -configuration Debug build
```

## Mobile builds legacy — Expo (archivado, solo si se necesita como referencia)

```
~/Developer/focus-expo-xcode-test/mobile/
```

Tiene `node_modules` y `mobile/.env` con keys de Supabase. No correr builds Expo desde otros worktrees.

## Idioma de copy

Toda copy visible al usuario va en **español neutral** (forma "tú"), nunca voseo argentino. Aplica a títulos, mensajes, empty states, errores, copy de Nova, notificaciones push y system prompts.

**Prohibido:** vos, tenés, sos, querés, podés, movelas, dormí, disfrutá, metés, agendá, tocás, abrís, hacelo, fijate, escribí, pensá, andá, mirá, decime, ponete.

**Usar en su lugar:** tú/te, tienes, eres, quieres, puedes, muévelas, duerme, disfruta, métela, agenda, tocas, abres, hazlo, fíjate, escribe, piensa, ve, mira, dime, ponte.

Antes de commitear copy nueva, hacer grep por: `vos|tenés|sos|querés|podés|movelas|dormí|disfrutá`. Comentarios internos del código (no visibles al usuario) pueden ir en cualquier dialecto.

## Memoria entre asistentes

- `CLAUDE.md` lo lee Claude Code automáticamente al inicio de cada sesión.
- `AGENTS.md` (este archivo) es referencia para Codex, Antigravity y otros agentes que sigan esa convención.
- Si actualizas uno, actualizá el otro.
- Ver también `SAFE_WORKFLOW.md` para el checklist práctico paso a paso.
