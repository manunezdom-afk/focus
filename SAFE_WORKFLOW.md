# Focus — Checklist seguro de trabajo

Checklist práctico para asegurar que cualquier sesión (manual o con agente IA) trabaja en el lugar correcto, sobre la rama correcta, y termina sin perder cambios.

Ver también: `AGENTS.md` (reglas completas) y `CLAUDE.md` (memoria para Claude Code).

---

## 1. ¿Estoy en la carpeta correcta?

```bash
pwd
```

**Debe dar exactamente**:
```
/Users/martinnunezdominguez/Developer/focus
```

❌ Si dice otra cosa (`~/Developer/focus-expo-xcode-test`, `~/Developer/spark`, `~/Developer/kairos`, `~/Documents/...`):
```bash
cd /Users/martinnunezdominguez/Developer/focus
```

---

## 2. ¿En qué rama estoy y está limpia?

```bash
git status --short
git branch --show-current
```

✅ Esperado: `focus-os-dev` (rama de trabajo) o `main` (rara vez).

❌ Si dice `codex/...`, `claude/...`, `feature/...`, `docs/...`: estás en una rama vieja.

```bash
# Volver a la rama autorizada
git switch focus-os-dev
```

❌ Si `status --short` muestra archivos modificados que vos no tocaste en esta sesión: avisar antes de seguir.

---

## 3. Actualizar desde GitHub

```bash
git fetch origin
git pull --ff-only origin main
```

Esto trae cambios de `main` a `focus-os-dev` sin perder commits propios.

❌ Si `pull --ff-only` falla con "Not possible to fast-forward":
- Significa que `focus-os-dev` y `main` divergieron.
- **No hacer merge ni rebase a ciegas.**
- Pedir ayuda primero.

---

## 4. Abrir Xcode en el proyecto correcto (iOS nativo Swift/SwiftUI)

```bash
open /Users/martinnunezdominguez/Developer/focus/ios-native/Focus.xcodeproj
```

✅ Verificar al abrir Xcode:
- Aparece el scheme `Focus`.
- Bundle ID: `me.usefocus.app`.
- Team: `D8UM897B2T`.
- iOS deployment target 17.0+.

❌ **NO abrir** ninguno de estos:
- `/ios/` (capacitor antiguo, huérfano en rama codex)
- `/legacy-capacitor-ios/` (archivado en main)
- `/mobile/` (expo antiguo, huérfano en rama codex)
- `/legacy-expo/` (archivado en main)

Si solo necesitás builds Expo legacy como referencia histórica:
```bash
open /Users/martinnunezdominguez/Developer/focus-expo-xcode-test/legacy-expo/...
```
(Ese worktree tiene `mobile/.env`. No editar código nuevo allí.)

---

## 5. Terminar cambios con commit y push

```bash
# 5.1 Ver qué cambió
git status
git diff --stat

# 5.2 Stagear ARCHIVOS ESPECÍFICOS (nunca -A ni .)
git add path/al/archivo1 path/al/archivo2

# 5.3 Commit con mensaje claro
git commit -m "tipo(scope): descripción corta"
#   tipos: feat | fix | chore | docs | refactor | test
#   scope: ios-native | api | web | docs | repo | nova | etc.

# 5.4 Sincronizar antes del push
git fetch origin
git pull --ff-only origin main

# 5.5 Push a la rama autorizada
git push origin focus-os-dev
```

❌ **PROHIBIDO**:
- `git push --force` a `main` o `focus-os-dev`
- `git push --no-verify`
- `git reset --hard` sin haber verificado `git log` y `git status`
- `git checkout main` cuando hay cambios sin commit
- Stagear `.claude/settings.local.json` (es config local)
- Stagear `node_modules/`, `dist/`, `.DS_Store`, `*.log`, builds

---

## 6. Caso especial: build Expo legacy (raro)

Solo si necesitás builds del Expo viejo como referencia o para reproducir un bug histórico:

```bash
cd /Users/martinnunezdominguez/Developer/focus-expo-xcode-test/mobile

# Verificar que el .env esté (sin él, Supabase queda en null)
test -f .env && echo OK || echo MISSING

# Build
npx expo run:ios --configuration Release
```

❌ **NO** edites código nuevo ahí. Es solo para builds históricos.

---

## 7. Si algo huele raro — diagnóstico rápido

Ejecutar y mostrar los resultados ANTES de cualquier acción destructiva:

```bash
pwd
git branch --show-current
git status --short
git log --oneline -5
git remote -v
git stash list | head -5
git worktree list
```

Si después de ver eso no estás seguro de qué hacer: **detenerse y preguntar al usuario**.

---

## 8. Reglas de oro (resumen)

| Regla | Por qué |
|---|---|
| Una sola rama de trabajo: `focus-os-dev` | Evita 41 ramas claude/* abandonadas |
| Una sola carpeta de trabajo: `/Users/martinnunezdominguez/Developer/focus` | Evita confusión con `focus-expo-xcode-test`, worktrees, etc. |
| iOS solo en `/ios-native/` | El resto es legacy |
| Nunca `git add -A` | El otro asistente puede tener cambios in-flight |
| Nunca `git push --force` a ramas compartidas | Borra commits sin aviso |
| Si dudás → parar y preguntar | Más barato que rollback |
