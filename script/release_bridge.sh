#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/script/load_env.sh"
load_homekit_env "$ROOT_DIR"

PROJECT_DIR="$ROOT_DIR/apps/bridge"
PROJECT="$PROJECT_DIR/BlackwattleHomeKitBridge.xcodeproj"
SCHEME="BlackwattleHomeKitBridge"
APP_NAME="HomeKit Bridge"
BUNDLE_ID="ad.blackwattle.homekit"
TEAM_ID="${HOMEKIT_TEAM_ID:-}"
VERSION="${1:-$(node -p "require('$ROOT_DIR/package.json').version")}"
PROFILE_SPECIFIER="${HOMEKIT_DISTRIBUTION_PROFILE_SPECIFIER:-}"
APP_IDENTITY="${HOMEKIT_DEVELOPER_ID_APPLICATION:-}"
INSTALLER_IDENTITY="${HOMEKIT_DEVELOPER_ID_INSTALLER:-}"
NOTARY_PROFILE="${HOMEKIT_NOTARY_KEYCHAIN_PROFILE:-}"
SKIP_NOTARY="${HOMEKIT_SKIP_NOTARY:-0}"
BUILD_ROOT="$ROOT_DIR/dist/bridge-release"
WORK_DIR="$BUILD_ROOT/work"
ARTIFACT_DIR="$BUILD_ROOT/artifacts"
ARCHIVE_PATH="$WORK_DIR/$APP_NAME.xcarchive"
EXPORT_PATH="$WORK_DIR/export"
APP_PATH="$EXPORT_PATH/$APP_NAME.app"
EXPORT_OPTIONS_TEMPLATE="$PROJECT_DIR/ExportOptions.developer-id.plist"
EXPORT_OPTIONS="$WORK_DIR/ExportOptions.plist"
PKG_PATH="$ARTIFACT_DIR/HomeKit-Bridge-$VERSION.pkg"
ZIP_PATH="$ARTIFACT_DIR/HomeKit-Bridge-$VERSION.app.zip"
CHECKSUMS_PATH="$ARTIFACT_DIR/checksums.txt"

fail() {
  echo "error: $*" >&2
  exit 1
}

require_env HOMEKIT_TEAM_ID
require_env HOMEKIT_DISTRIBUTION_PROFILE_SPECIFIER
require_env HOMEKIT_DEVELOPER_ID_APPLICATION
require_env HOMEKIT_DEVELOPER_ID_INSTALLER
if [[ "$SKIP_NOTARY" != "1" ]]; then
  require_env HOMEKIT_NOTARY_KEYCHAIN_PROFILE
fi

"$ROOT_DIR/script/verify_release_signing.sh"

rm -rf "$WORK_DIR" "$ARTIFACT_DIR"
mkdir -p "$WORK_DIR" "$ARTIFACT_DIR"

cd "$PROJECT_DIR"
xcodegen generate

sed \
  -e "s/HOMEKIT_DISTRIBUTION_PROFILE_SPECIFIER/$PROFILE_SPECIFIER/g" \
  -e "s/HOMEKIT_TEAM_ID/$TEAM_ID/g" \
  "$EXPORT_OPTIONS_TEMPLATE" > "$EXPORT_OPTIONS"

xcodebuild archive \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=macOS,variant=Mac Catalyst' \
  -archivePath "$ARCHIVE_PATH" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_IDENTITY="$APP_IDENTITY" \
  PROVISIONING_PROFILE_SPECIFIER="$PROFILE_SPECIFIER"

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS"

[[ -d "$APP_PATH" ]] || fail "export did not produce $APP_PATH"

codesign --verify --deep --strict --verbose=2 "$APP_PATH"
codesign -dv --verbose=4 "$APP_PATH"
codesign -d --entitlements :- "$APP_PATH" > "$ARTIFACT_DIR/entitlements.plist"

ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

if [[ "$SKIP_NOTARY" != "1" ]]; then
  xcrun notarytool submit "$ZIP_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$APP_PATH"
  xcrun stapler validate "$APP_PATH"
  rm -f "$ZIP_PATH"
  ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"
fi

pkgbuild \
  --component "$APP_PATH" \
  --install-location /Applications \
  --identifier "$BUNDLE_ID.pkg" \
  --version "$VERSION" \
  --sign "$INSTALLER_IDENTITY" \
  "$PKG_PATH"

pkgutil --check-signature "$PKG_PATH"

if [[ "$SKIP_NOTARY" != "1" ]]; then
  xcrun notarytool submit "$PKG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$PKG_PATH"
  xcrun stapler validate "$PKG_PATH"
fi

(
  cd "$ARTIFACT_DIR"
  shasum -a 256 "$(basename "$PKG_PATH")" "$(basename "$ZIP_PATH")" > "$CHECKSUMS_PATH"
)

echo
echo "Release artifacts:"
echo "  $PKG_PATH"
echo "  $ZIP_PATH"
echo "  $CHECKSUMS_PATH"
echo
if [[ "$SKIP_NOTARY" == "1" ]]; then
  echo "Notarization skipped because HOMEKIT_SKIP_NOTARY=1."
fi
