#!/usr/bin/env bash
# Levanta el Vite legacy en LAN para que el Migration Mirror del iPhone
# pueda alcanzarlo. Imprimirá una URL "Network: http://<IP>:5173" — copia
# esa URL en el setup del Mirror la primera vez.
#
# Uso:
#   bash mobile/scripts/serve-legacy.sh
#
# Requisitos:
#   - Mac y iPhone en la misma Wi-Fi
#   - npm i ya corrido en la raíz del repo (no en mobile/)

set -euo pipefail

# Sube de mobile/scripts/ a la raíz del repo legacy
cd "$(dirname "$0")/../.."

if [ ! -f "package.json" ] || [ ! -f "vite.config.js" ]; then
  echo "✘ No encuentro la raíz del repo legacy (esperaba package.json + vite.config.js)."
  echo "  cwd: $(pwd)"
  exit 1
fi

echo "▶ Levantando Vite legacy en LAN (puerto 5173)…"
echo "  Pega la URL 'Network:' que imprima abajo en el setup del Migration Mirror."
echo
exec npm run dev -- --host 0.0.0.0 --port 5173
