#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm run build

port="${PORT:-3001}"
if curl --fail --silent --max-time 2 "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
  echo "Production assets refreshed for http://127.0.0.1:${port}"
  echo "The server was not restarted. Refresh the browser to load the new dist/ assets."
else
  echo "Build complete. No server responded on http://127.0.0.1:${port}."
  echo "Start the demo with: npm run hackathon-boot"
fi
