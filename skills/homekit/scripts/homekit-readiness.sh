#!/usr/bin/env bash
set -euo pipefail

if ! command -v homekit >/dev/null 2>&1; then
  echo "homekit binary not found on PATH" >&2
  echo "Install with: npm install -g homekit-cli" >&2
  echo "Or run checks without installing globally: npx -y homekit-cli bridge setup --format json && npx -y homekit-cli status --format json" >&2
  exit 127
fi

echo "== homekit bridge setup =="
homekit bridge setup --format json

echo
echo "== homekit bridge status =="
homekit bridge status --format json

echo
echo "== homekit status =="
homekit status --format json

echo
echo "== homekit bridge logs command =="
homekit bridge logs
