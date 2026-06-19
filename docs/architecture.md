# Architecture

`homekit-cli` has two runtime halves:

- `HomeKit Bridge.app`: signed Mac Catalyst app with HomeKit entitlement.
- `homekit`: TypeScript CLI built with Incur.

The CLI cannot access HomeKit directly. It sends newline-delimited JSON RPC requests to the bridge socket. The bridge owns `HMHomeManager`, reads HomeKit state, performs explicit control and mutation requests, and returns structured JSON.

The command tree in `packages/cli/src/cli.ts` is the single source of truth for:

- human CLI commands
- MCP stdio via `homekit --mcp`
- MCP registration via `homekit mcp add`
- `homekit --llms`

Agent skills are distributed separately through the external Skills CLI from `skills/homekit`. This keeps the workflow skill hand-written and lets it include scenario references and helper scripts.

The wire protocol is versioned. CLI and bridge major protocol versions must match.

The app has no webhook server, external callback router, or TUI. The bridge is a local HomeKit boundary; the CLI/MCP is the product surface.

## Command Scope

The command surface includes:

- read-only HomeKit inspection
- explicit accessory actuation
- room, zone, scene, automation, accessory removal, and rename mutations
- bridge lifecycle commands
- MCP setup and external skill install guidance

See [commands.md](commands.md) for full command coverage and implementation status.

## Distribution Boundary

The CLI is distributed through npm and can be run with:

```bash
npx homekit-cli <command>
```

The bridge app is distributed through GitHub Releases as a signed and notarized macOS artifact. This keeps the HomeKit entitlement, app signature, notarization, and release checksums in the native macOS distribution path while still allowing `npx homekit-cli bridge setup` to install and launch the bridge.

The npm package should orchestrate install, verification, launch, MCP setup, and skill setup. It should not be the primary container for the `.app` bundle.
