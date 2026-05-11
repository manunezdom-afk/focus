#!/usr/bin/env bash
# scripts/audit-quick.sh
#
# Auditoría rápida y read-only del estado del proyecto Focus.
# No instala nada, no commitea, no modifica archivos.
# Pensado para correr antes de iniciar trabajo o antes de commitear cambios grandes.
#
# Uso:   bash scripts/audit-quick.sh
# O bien chmod +x y luego ./scripts/audit-quick.sh

set -u  # tratar variables undefined como error; SIN -e para que un grep vacío no aborte todo

cd "$(dirname "$0")/.."

section() { printf "\n\033[1;34m▍ %s\033[0m\n" "$1"; }
ok()     { printf "  \033[1;32m✓\033[0m %s\n" "$1"; }
warn()   { printf "  \033[1;33m⚠\033[0m %s\n" "$1"; }
miss()   { printf "  \033[1;31m✗\033[0m %s\n" "$1"; }

section "Estado git"
git status --short
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
HEAD=$(git rev-parse --short HEAD 2>/dev/null)
echo "  branch=$BRANCH head=$HEAD"

section "Herramientas instaladas"
for t in gh vercel supabase node npm swiftlint periphery xcbeautify gitleaks osv-scanner semgrep; do
  if command -v "$t" >/dev/null 2>&1; then
    ok "$t  $($t --version 2>&1 | head -1)"
  else
    miss "$t (no instalado)"
  fi
done
ok "xcode  $(xcodebuild -version 2>&1 | head -1)"

section "gh auth"
if gh auth status >/dev/null 2>&1; then
  ok "gh logueado"
else
  warn "gh NO logueado — usá: gh auth login"
fi

section "Estado ios-native"
COUNT_SWIFT=$(find ios-native -type f -name "*.swift" 2>/dev/null | wc -l | tr -d ' ')
LINES_SWIFT=$(find ios-native -type f -name "*.swift" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
ok "$COUNT_SWIFT archivos Swift · $LINES_SWIFT líneas"

section "Búsqueda de marcadores internos en código Swift"
TODOS=$(grep -rIn -E "TODO|FIXME|XXX|HACK" ios-native/Focus/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TODOS" -eq 0 ]; then ok "0 TODO/FIXME/XXX/HACK"; else warn "$TODOS marcadores encontrados"; fi

FASES=$(grep -rIn -E '"[^"]*FASE[^"]*"|"[^"]*Pr.ximamente[^"]*"' ios-native/Focus/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$FASES" -eq 0 ]; then ok "0 strings visibles 'FASE' / 'Próximamente'"; else warn "$FASES strings visibles internos"; fi

UNWRAPS=$(grep -rIn '\.first!\|\.last!\|as!\|try!' ios-native/Focus/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNWRAPS" -eq 0 ]; then ok "0 force-unwraps"; else warn "$UNWRAPS force-unwraps detectados"; fi

section "Búsqueda básica de secrets (patrones públicos)"
SECRETS=$(grep -rInE 'sbp_[A-Za-z0-9]{16,}|sk_(live|test)_[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}' . \
  --include="*.swift" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --include="*.json" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=legacy-expo --exclude-dir=legacy-capacitor-ios 2>/dev/null | wc -l | tr -d ' ')
if [ "$SECRETS" -eq 0 ]; then ok "0 matches de patrones de secret"; else warn "$SECRETS posibles secrets — investigar (NO imprimir valores)"; fi

LEAK_SRC=$(grep -rInE "SUPABASE_SERVICE_ROLE_KEY|service_role" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$LEAK_SRC" -eq 0 ]; then ok "service_role NO aparece en src/"; else warn "service_role aparece $LEAK_SRC veces en src/ — REVISAR"; fi

section "Supabase"
MIG_COUNT=$(ls -1 supabase/migrations 2>/dev/null | grep -c "^[0-9]" || echo 0)
ok "$MIG_COUNT migraciones numeradas"
RLS_COUNT=$(grep -cE "ROW LEVEL SECURITY" supabase/schema.sql 2>/dev/null || echo 0)
ok "$RLS_COUNT ALTER TABLE ENABLE RLS en schema.sql"

section "Vercel"
if [ -f vercel.json ]; then ok "vercel.json presente"; else miss "vercel.json no encontrado"; fi
if [ -d .vercel ]; then warn ".vercel/ presente — proyecto linkado (cuidado con env vars)"; else ok ".vercel/ ausente (CLI no linkado)"; fi

section "Playwright"
if [ -f playwright.config.js ]; then ok "playwright.config.js presente"; fi
if [ -f playwright.audit.config.js ]; then ok "playwright.audit.config.js presente"; fi
TESTS_E2E=$(find tests/e2e -name "*.spec.*" 2>/dev/null | wc -l | tr -d ' ')
TESTS_AUDIT=$(find tests/audit -name "*.spec.*" 2>/dev/null | wc -l | tr -d ' ')
ok "$TESTS_E2E specs en tests/e2e · $TESTS_AUDIT specs en tests/audit"

echo ""
echo "Audit rápido completado. Para profundizar: editar FOCUS_AUDIT_MASTER.md."
