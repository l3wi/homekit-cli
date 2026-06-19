# Setup And Troubleshooting

Use this reference when the user asks whether HomeClaw is installed, reachable, permitted by HomeKit, or wired into MCP.

## Required App

HomeKit access requires a signed App Store or TestFlight app. Install [HomeClaw from the Mac App Store](https://apps.apple.com/us/app/homeclaw/id6759682551?mt=12), launch it once, and approve HomeKit permission.

HomeClaw bundles its own CLI and MCP server, but this skill uses `homekit-cli` instead. Skip HomeClaw's bundled CLI/MCP setup and use `npx -y homekit-cli`, `npx -y homekit-cli --mcp`, and this `homekit` skill.

## Readiness Checks

Run the helper script for a compact local check:

```bash
skills/homekit/scripts/homekit-readiness.sh
```

Equivalent manual sequence:

```bash
npx -y homekit-cli bridge setup --format json
npx -y homekit-cli bridge status --format json
npx -y homekit-cli status --format json
```

Interpretation:

- `bridge setup` should verify HomeClaw and return capabilities.
- `status` should show at least one visible home once HomeClaw has HomeKit permission.
- If HomeKit permission is missing, open HomeClaw directly and approve HomeKit access.

## Provider Boundary

The CLI itself does not hold HomeKit entitlement. It talks to HomeClaw over its local Unix socket.

Default socket:

```text
~/Library/Group Containers/group.com.shahine.homeclaw/homeclaw.sock
```

Use `HOMEKIT_SOCKET_PATH` only when a socket override is needed.

## Logs

Ask the CLI for the exact log command:

```bash
homekit bridge logs
```

Run the returned `log stream` command when investigating provider startup, HomeKit permission, protocol mismatch, or rejected writes.

## MCP Setup

Register MCP:

```bash
npx -y homekit-cli mcp add
```

Run MCP directly:

```bash
npx -y homekit-cli --mcp
```

Install this workflow skill:

```bash
npx skills add l3wi/homekit-cli --skill homekit
```

Use the example configs in the repo:

```text
examples/mcp.readonly.example.json
examples/mcp.write.example.json
```

The readonly/write profile label is operator guidance only. Real safety gates are still `allowActuation`, `allowMutation`, exact ids, and provider-side checks.

## Common Failure Modes

- **HomeClaw missing**: install [HomeClaw from the Mac App Store](https://apps.apple.com/us/app/homeclaw/id6759682551?mt=12), launch it once, approve HomeKit permission, then retry `npx -y homekit-cli bridge setup`.
- **No homes visible**: open HomeClaw in the GUI and approve HomeKit permission; confirm the macOS user is in the Home.
- **Permission denied**: confirm the CLI and HomeClaw run as the same macOS user.
