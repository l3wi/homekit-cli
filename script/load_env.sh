#!/usr/bin/env bash

load_homekit_env() {
  local root_dir="$1"
  local env_file

  for env_file in "$root_dir/.env" "$root_dir/.env.local"; do
    if [[ -f "$env_file" ]]; then
      set -a
      # shellcheck source=/dev/null
      source "$env_file"
      set +a
    fi
  done
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "error: $name must be set in .env.local, .env, or the environment." >&2
    exit 2
  fi
}
