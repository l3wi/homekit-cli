#!/usr/bin/env bash
set -euo pipefail

PROFILE_PATH="${1:-}"
[[ -n "$PROFILE_PATH" ]] || {
  echo "usage: $0 /path/to/profile.provisionprofile" >&2
  exit 2
}

[[ -f "$PROFILE_PATH" ]] || {
  echo "profile does not exist: $PROFILE_PATH" >&2
  exit 2
}

TMP_PLIST="$(mktemp -t homekit-profile.XXXXXX.plist)"
trap 'rm -f "$TMP_PLIST"' EXIT

security cms -D -i "$PROFILE_PATH" > "$TMP_PLIST"

UUID="$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$TMP_PLIST")"
NAME="$(/usr/libexec/PlistBuddy -c 'Print :Name' "$TMP_PLIST")"
TEAM_IDENTIFIER="$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' "$TMP_PLIST")"
APP_IDENTIFIER="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:application-identifier' "$TMP_PLIST")"
GET_TASK_ALLOW="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:get-task-allow' "$TMP_PLIST" 2>/dev/null || true)"

PROFILE_DIR="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
DESTINATION="$PROFILE_DIR/$UUID.provisionprofile"

mkdir -p "$PROFILE_DIR"
cp "$PROFILE_PATH" "$DESTINATION"

echo "Installed provisioning profile:"
echo "  Name: $NAME"
echo "  UUID: $UUID"
echo "  Team: $TEAM_IDENTIFIER"
echo "  App Identifier: $APP_IDENTIFIER"
echo "  Path: $DESTINATION"
echo
if [[ "$GET_TASK_ALLOW" == "true" ]]; then
  echo "Use this for development builds:"
  echo "  HOMEKIT_PROVISIONING_PROFILE_SPECIFIER=\"$NAME\""
else
  echo "Use this for Developer ID release builds:"
  echo "  HOMEKIT_DISTRIBUTION_PROFILE_SPECIFIER=\"$NAME\""
fi
