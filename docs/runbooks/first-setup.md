# First Setup

## User Setup

1. Run setup through npm:

```bash
npx homekit-cli bridge setup
```

2. Approve any macOS HomeKit permission prompt shown by `HomeKit Bridge.app`.
3. Verify the bridge:

```bash
npx homekit-cli status --json
```

4. Add MCP if needed:

```bash
npx homekit-cli mcp add
```

Install the curated workflow skill:

```bash
npx skills add l3wi/homekit-cli --skill homekit
```

`bridge setup` is responsible for downloading the signed bridge app from GitHub Releases, verifying it, installing it into `~/Applications`, launching it, and waiting for the socket.

## Development Setup

1. Build or install the signed bridge app.
2. Open the bridge app once from Xcode or the build script.
3. Grant HomeKit permission.
4. Build the CLI:

```bash
bun run build
```

5. Verify with the temp socket when using the development profile:

```bash
HOMEKIT_USE_TMP_SOCKET=1 ./script/build_and_run.sh --verify
HOMEKIT_USE_TMP_SOCKET=1 node packages/cli/dist/bin.js status --json
```
