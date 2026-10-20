#!/usr/bin/env bash
# Saca capturas de la web exportada con Chrome headless (CDP).
#   scripts/shot.sh <salida.png> <ancho> <alto> [seed:<ruta>]
set -euo pipefail

SALIDA="${1:-/tmp/opencode/shot.png}"
ANCHO="${2:-1440}"
ALTO="${3:-1000}"
MODE="${4:-}"

cd "$(dirname "$0")/.."

if [ "$MODE" = "seed" ]; then
  URL="http://localhost:8101/seed.html"
elif [[ "$MODE" == seed:* ]]; then
  RUTA="${MODE#seed:}"
  URL="http://localhost:8101/seed.html?ruta=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$RUTA")"
else
  URL="http://localhost:8101/"
fi

SHOT_OUT="$SALIDA" node scripts/inspect.mjs "$URL" "$ANCHO" "$ALTO" >/dev/null
echo "$SALIDA ${ANCHO}x${ALTO}"
