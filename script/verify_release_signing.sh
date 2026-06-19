#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/script/load_env.sh"
load_homekit_env "$ROOT_DIR"

TEAM_ID="${HOMEKIT_TEAM_ID:-}"
APP_IDENTITY="${HOMEKIT_DEVELOPER_ID_APPLICATION:-}"
INSTALLER_IDENTITY="${HOMEKIT_DEVELOPER_ID_INSTALLER:-}"
PROFILE_SPECIFIER="${HOMEKIT_DISTRIBUTION_PROFILE_SPECIFIER:-}"

require_env HOMEKIT_TEAM_ID
require_env HOMEKIT_DEVELOPER_ID_APPLICATION
require_env HOMEKIT_DEVELOPER_ID_INSTALLER
require_env HOMEKIT_DISTRIBUTION_PROFILE_SPECIFIER

echo "Checking Developer ID Application identity..."
security find-identity -p codesigning -v | grep -F "$APP_IDENTITY" >/dev/null
echo "  found application signing identity"

echo "Checking Developer ID Installer certificate..."
security find-certificate -a -c "$INSTALLER_IDENTITY" -Z >/dev/null
echo "  found installer signing identity"

PROFILE_DIRS=(
  "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
  "$HOME/Library/MobileDevice/Provisioning Profiles"
)

FOUND_PROFILE=0
for profile_dir in "${PROFILE_DIRS[@]}"; do
  [[ -d "$profile_dir" ]] || continue
  while IFS= read -r -d '' profile; do
    if security cms -D -i "$profile" 2>/dev/null | grep -F "$PROFILE_SPECIFIER" >/dev/null; then
      FOUND_PROFILE=1
      break
    fi
  done < <(find "$profile_dir" -type f \( -name '*.provisionprofile' -o -name '*.mobileprovision' \) -print0)
  [[ "$FOUND_PROFILE" == "1" ]] && break
done

if [[ "$FOUND_PROFILE" != "1" ]]; then
  cat >&2 <<EOF
Could not find an installed provisioning profile matching:
  $PROFILE_SPECIFIER

Install the Developer ID provisioning profile, then rerun this command.
EOF
  exit 2
fi

echo "  found provisioning profile: $PROFILE_SPECIFIER"
echo "Release signing prerequisites look present."
