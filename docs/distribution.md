# Distribution

`homekit-cli` uses two distribution channels:

- npm for the TypeScript CLI, MCP server, schemas, and docs.
- external Skills CLI for the curated `homekit` agent skill.
- GitHub Releases for the signed and notarized macOS bridge app.

The npm package must not be the primary carrier for the entitlement-bearing app. `npx` is the installer and setup front door; GitHub Releases carries the native app artifact.

## User Flow

Users should be able to run:

```bash
npx homekit-cli bridge setup
```

That command should:

1. Detect macOS architecture.
2. Resolve the latest compatible bridge release.
3. Download the bridge `.zip` or `.pkg` from GitHub Releases.
4. Verify the release checksum.
5. Verify the app signature and team identifier.
6. Install the app into `~/Applications`.
7. Launch the bridge with Launch Services.
8. Wait for socket readiness.
9. Print MCP and external skill setup guidance.

Normal commands can then run through npm or an installed binary:

```bash
npx homekit-cli status
npx homekit-cli accessories list
npx homekit-cli --mcp
npx skills add l3wi/homekit-cli --skill homekit
```

## Release Artifacts

Primary GitHub Release artifacts:

```text
HomeKit-Bridge-<version>.pkg
HomeKit-Bridge-<version>.app.zip
checksums.txt
```

The `.pkg` is the default user-facing installer. It installs `HomeKit Bridge.app` into `/Applications`, which makes Launch Services discovery reliable for:

```bash
open -gj -b ad.blackwattle.homekit
```

The `.app.zip` is a secondary artifact for developers and users who want to inspect or install the app manually.

The release artifact must contain `HomeKit Bridge.app` with:

```text
Bundle ID: ad.blackwattle.homekit
Team ID: configured locally through HOMEKIT_TEAM_ID
HomeKit entitlement: present
App Group entitlement: present for production releases
```

Development builds may use `HOMEKIT_USE_TMP_SOCKET=1` without the App Group entitlement. Production releases should use the App Group socket so the path is stable.

## Signature Verification

`bridge setup` should reject artifacts that do not match the expected identity:

```bash
codesign -dv --verbose=4 "HomeKit Bridge.app"
codesign -d --entitlements :- "HomeKit Bridge.app"
```

Expected values:

```text
Identifier=ad.blackwattle.homekit
TeamIdentifier=<HOMEKIT_TEAM_ID>
com.apple.developer.homekit=true
```

For production releases, also expect:

```text
com.apple.security.application-groups includes group.ad.blackwattle.homekit
```

## Production Signing Prerequisites

Production releases use Developer ID signing and Apple notarization.

Required local certificates are configured by `HOMEKIT_DEVELOPER_ID_APPLICATION` and `HOMEKIT_DEVELOPER_ID_INSTALLER` in `.env.local`.

Required provisioning profile:

```text
Type: Developer ID
Platform: Mac Catalyst
Bundle ID: ad.blackwattle.homekit
Team ID: your Apple Developer Team ID
Capabilities: HomeKit, App Groups
App Group: group.ad.blackwattle.homekit
```

Install a downloaded provisioning profile with:

```bash
bun run bridge:install-profile -- /path/to/HomeKit_Bridge_Developer_ID.provisionprofile
```

Then copy `.env.example` to `.env.local` and set the profile name printed by the installer:

```bash
cp .env.example .env.local
$EDITOR .env.local
```

Verify local signing prerequisites:

```bash
bun run bridge:verify-release-signing
```

## Notarization Credentials

Store App Store Connect API key credentials in the keychain once:

```bash
xcrun notarytool store-credentials <notary-keychain-profile> \
  --key /path/to/AuthKey_KEYID.p8 \
  --key-id KEYID \
  --issuer ISSUER_UUID
```

Set `HOMEKIT_NOTARY_KEYCHAIN_PROFILE` in `.env.local` to the keychain profile name you stored.

## Build A Release

Create signed, notarized artifacts:

```bash
bun run bridge:release -- 0.1.0
```

Artifacts are written to:

```text
dist/bridge-release/artifacts/
```

For local script debugging only, notarization can be skipped:

```bash
HOMEKIT_SKIP_NOTARY=1 bun run bridge:release -- 0.1.0
```

Do not publish skipped-notary artifacts.

## Install Location

Default install location:

```text
/Applications/HomeKit Bridge.app
```

The `.pkg` installs system-wide because it is the production path. The CLI setup command should still avoid writing to `/Applications` directly; it should ask the user to install the signed `.pkg` or invoke the system installer with explicit user consent.

The app should be launched with:

```bash
open -gj -b ad.blackwattle.homekit
```

## Socket Paths

Production releases should use:

```text
~/Library/Group Containers/group.ad.blackwattle.homekit/bridge.sock
```

Development builds that do not include the App Group entitlement use:

```text
${TMPDIR}/ad.blackwattle.homekit.sock
```

## Version Compatibility

The CLI and bridge use protocol version negotiation. `bridge setup` should require matching major protocol versions before reporting success.

If the bridge is missing, too old, too new, unsigned, signed by the wrong team, or missing required entitlements, setup should fail with a concrete remediation step.
