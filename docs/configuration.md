# Configuration

Environment variables:

- `HOMEKIT_SOCKET_PATH`: override the Unix socket path.
- `HOMEKIT_APP_GROUP_IDENTIFIER`: override the app group container identifier.
- `HOMEKIT_USE_TMP_SOCKET=1`: use `${TMPDIR}/ad.blackwattle.homekit.sock` for development.
- `HOMEKIT_MCP_PROFILE=readonly|write`: operator-facing MCP profile label. This does not bypass `allowActuation` or `allowMutation`.
- `HOMEKIT_DEVELOPMENT_TEAM`: Apple Developer Team ID for local development signing.
- `HOMEKIT_PROVISIONING_PROFILE_SPECIFIER`: local development provisioning profile name or UUID.
- `HOMEKIT_TEAM_ID`: Apple Developer Team ID for Developer ID release signing.
- `HOMEKIT_DISTRIBUTION_PROFILE_SPECIFIER`: Developer ID provisioning profile name or UUID.
- `HOMEKIT_DEVELOPER_ID_APPLICATION`: full Developer ID Application certificate name.
- `HOMEKIT_DEVELOPER_ID_INSTALLER`: full Developer ID Installer certificate name.
- `HOMEKIT_NOTARY_KEYCHAIN_PROFILE`: notarytool keychain profile.
- `HOMEKIT_SKIP_NOTARY=1`: debug release script without notarization. Do not publish skipped-notary artifacts.

Copy `.env.example` to `.env.local` and fill local signing values there. `.env` and `.env.local` are ignored by git.

Production default socket path is the app group container:

```text
~/Library/Group Containers/group.ad.blackwattle.homekit/bridge.sock
```

Development fallback:

```text
${TMPDIR}/ad.blackwattle.homekit.sock
```

## Development Signing

Local development can use a HomeKit-only provisioning profile and the temp socket path:

```bash
cp .env.example .env.local
$EDITOR .env.local
HOMEKIT_USE_TMP_SOCKET=1 ./script/build_and_run.sh --verify
HOMEKIT_USE_TMP_SOCKET=1 npx homekit-cli status
```

Production bridge releases should include the App Group entitlement and use the app group socket path.
