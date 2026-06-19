# Setup And Troubleshooting

Use this reference when the user asks whether HomeKit Bridge is installed, reachable, permitted by HomeKit, or wired into MCP.

## Readiness Checks

Run the helper script for a compact local check:

```bash
skills/homekit/scripts/homekit-readiness.sh
```

Equivalent manual sequence:

```bash
homekit bridge setup --json
homekit bridge status --json
homekit status --json
```

Interpretation:

- `bridge setup` should launch `HomeKit Bridge.app`, wait for the Unix socket, perform protocol negotiation, and return capabilities.
- `status` should show at least one visible home once the app has HomeKit permission.
- If HomeKit permission is missing, instruct the user to open `HomeKit Bridge.app` directly and approve HomeKit access.

## Socket And App Boundary

The CLI talks to the signed bridge over a per-user Unix socket. The CLI itself does not hold HomeKit entitlement.

Expected socket preference:

```text
~/Library/Group Containers/group.ad.blackwattle.homekit/bridge.sock
```

Development fallback:

```text
${TMPDIR}/ad.blackwattle.homekit.sock
```

Use this only for development:

```bash
HOMEKIT_USE_TMP_SOCKET=1 homekit status --json
```

## Logs

Ask the CLI for the exact log command:

```bash
homekit bridge logs
```

Then run the returned `log stream` command when investigating bridge startup, HomeKit permission, socket bind/unlink behavior, protocol mismatch, or rejected writes.

## MCP Setup

Register MCP:

```bash
homekit mcp add
```

Run MCP directly:

```bash
homekit --mcp
```

Use the example configs in the repo:

```text
examples/mcp.readonly.example.json
examples/mcp.write.example.json
```

The readonly/write profile label is operator guidance only. Real safety gates are still `allowActuation`, `allowMutation`, exact ids, and bridge-side checks.

## Common Failure Modes

- **Launch Services cannot find app**: install `HomeKit Bridge.app` in `/Applications`, then retry `homekit bridge setup`.
- **No homes visible**: open the app in the GUI and approve HomeKit permission; confirm the macOS user is in the Home.
- **Protocol mismatch**: update CLI and bridge together; major protocol versions are lockstep.
- **Stale socket**: stop the bridge, remove only the expected per-user socket path, relaunch with `homekit bridge launch`.
- **Permission denied or rejected peer**: confirm the CLI and bridge are running as the same macOS user.
