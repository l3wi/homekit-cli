#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/script/load_env.sh"
load_homekit_env "$ROOT_DIR"

APP_NAME="HomeKit Bridge"
PROCESS_NAME="HomeKit Bridge"
PROJECT_DIR="$ROOT_DIR/apps/bridge"
PROJECT="$PROJECT_DIR/BlackwattleHomeKitBridge.xcodeproj"
SCHEME="BlackwattleHomeKitBridge"
BUILD_DIR="$PROJECT_DIR/build"
APP_BUNDLE="$BUILD_DIR/Build/Products/Debug-maccatalyst/$APP_NAME.app"
ALLOW_PROVISIONING_UPDATES="${XCODE_ALLOW_PROVISIONING_UPDATES:-1}"
DEVELOPMENT_TEAM="${HOMEKIT_DEVELOPMENT_TEAM:-}"
PROVISIONING_PROFILE_SPECIFIER="${HOMEKIT_PROVISIONING_PROFILE_SPECIFIER:-}"

XCODEBUILD_FLAGS=()
if [[ -n "$PROVISIONING_PROFILE_SPECIFIER" ]]; then
  require_env HOMEKIT_DEVELOPMENT_TEAM
  XCODEBUILD_FLAGS+=(
    "CODE_SIGN_STYLE=Manual"
    "DEVELOPMENT_TEAM=$DEVELOPMENT_TEAM"
    "PROVISIONING_PROFILE_SPECIFIER=$PROVISIONING_PROFILE_SPECIFIER"
  )
elif [[ "$ALLOW_PROVISIONING_UPDATES" == "1" ]]; then
  if [[ -n "$DEVELOPMENT_TEAM" ]]; then
    XCODEBUILD_FLAGS+=("DEVELOPMENT_TEAM=$DEVELOPMENT_TEAM")
  fi
  XCODEBUILD_FLAGS+=("-allowProvisioningUpdates")
elif [[ -n "$DEVELOPMENT_TEAM" ]]; then
  XCODEBUILD_FLAGS+=("DEVELOPMENT_TEAM=$DEVELOPMENT_TEAM")
fi

pkill -x "$PROCESS_NAME" >/dev/null 2>&1 || true

cd "$PROJECT_DIR"
xcodegen generate
xcodebuild \
  "${XCODEBUILD_FLAGS[@]}" \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination 'platform=macOS,variant=Mac Catalyst' \
  -derivedDataPath "$BUILD_DIR" \
  build

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$PROCESS_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate 'subsystem == "ad.blackwattle.homekit"'
    ;;
  --verify|verify)
    open_app
    sleep 2
    pgrep -x "$PROCESS_NAME" >/dev/null
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
