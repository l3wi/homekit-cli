#!/usr/bin/env bash
set -euo pipefail

if ! command -v homekit >/dev/null 2>&1; then
  echo "homekit binary not found on PATH" >&2
  echo "Install with: npm install -g homekit-cli" >&2
  exit 127
fi

echo "== homekit bridge setup =="
homekit bridge setup --json

echo
echo "== homekit status =="
homekit status --json

echo
echo "== homekit bridge logs command =="
homekit bridge logs

