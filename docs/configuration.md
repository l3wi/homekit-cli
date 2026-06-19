# Configuration

`main` is a CLI-only package over HomeClaw. It does not contain native app signing, provisioning, notarization, or app-group configuration.

## HomeClaw Prerequisite

HomeKit access requires a signed App Store or TestFlight app. Install [HomeClaw from the Mac App Store](https://apps.apple.com/us/app/homeclaw/id6759682551?mt=12), launch it once, and approve HomeKit permission.

HomeClaw bundles its own CLI and MCP server, but this project intentionally skips those surfaces. Use this package's `homekit` CLI, `homekit --mcp`, docs, schemas, and `npx skills` package instead.

## Environment

- `HOMEKIT_SOCKET_PATH`: optional HomeClaw socket override.
- `HOMEKIT_USE_LEGACY_TMP_SOCKET=1`: use `/tmp/homeclaw.sock` instead of the App Group socket.
- `HOMEKIT_MCP_PROFILE`: optional operator label for MCP profile intent, such as `readonly` or `write`.

Safety is controlled by command flags, not by environment:

- physical actuation requires `--allow-actuation`
- structural mutations require `--allow-mutation`

## HomeClaw Socket

Default socket path:

```text
~/Library/Group Containers/group.com.shahine.homeclaw/homeclaw.sock
```

Install and launch HomeClaw once, approve HomeKit permission, then run:

```bash
homekit bridge setup --format json
homekit status --format json
```
