#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

port="${PORT:-3001}"
if curl --fail --silent --max-time 1 "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
  echo "GemmaKaizo is already running at http://127.0.0.1:${port}"
  exit 0
fi

if [[ ! -f dist/index.html ]]; then
  echo "No production build found; creating dist/ before booting."
  npm run build
fi

exec env NODE_ENV=production PORT="$port" npm run server
