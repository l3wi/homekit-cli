---
name: homekit
description: Use the `homekit` CLI and MCP server safely with HomeClaw for HomeKit setup, read-only inspection, troubleshooting, explicit accessory control, webhooks, triggers, and structural HomeKit changes. Trigger when an agent needs to inspect or operate HomeKit accessories, rooms, zones, scenes, automations, events, webhooks, or triggers through homekit-cli.
---

# HomeKit

Use `homekit` as the only HomeKit interface unless the user explicitly asks to leave this CLI. Start read-only, identify exact targets, then write only when the user has asked for the specific physical or structural change.

## Progressive Disclosure

Do not memorize or duplicate the command schema. Ask the CLI for the level of detail you need:

```bash
homekit --help
homekit <group> --help
homekit <command> --schema --format json
homekit --llms
```

Use `--format json` for evidence you will parse or compare. Use `--schema --format json` before MCP/tool calls when argument names, output fields, or safety flags are uncertain.

## Load References

Load only the reference that matches the user request:

- `references/setup-and-troubleshooting.md`: HomeClaw setup, readiness, HomeKit permission, logs, MCP install.
- `references/inspection-workflows.md`: homes, rooms, accessories, scenes, automations, zones, event logs, device-map, and anomaly investigation.
- `references/write-workflows.md`: accessory control, room/zone/scene/automation mutations, exact-id writes, verification, and audit reporting.
- `references/command-groups.md`: concise command group map and implementation caveats.

Use `scripts/homekit-readiness.sh` when you need a deterministic local setup/readiness check.

## Operating Rules

- Treat locks, garage doors, gates, doors, windows, covers, security systems, cameras, doorbells, occupancy, presence, scenes, and automations as safety-critical.
- Never control a device just to test connectivity.
- Never use `--allow-actuation` unless the user asked for the exact physical state change.
- Never use `--allow-mutation` unless the user asked for the exact HomeKit structural change.
- Never wildcard writes. Resolve names to exact IDs first, then use those exact IDs.
- If multiple accessories, scenes, rooms, zones, or automations match, show candidates and ask the user to choose.
- After any accepted write, report the command family, target name/id, requested value/change, verification result, and returned `auditId` when present.

## Default Flow

1. Check HomeClaw readiness:

   ```bash
   homekit bridge setup --format json
   homekit status --format json
   ```

2. Build context with read-only commands:

   ```bash
   homekit homes list --format json
   homekit rooms list --format json
   homekit accessories list --format json
   homekit scenes list --format json
   homekit automations list --format json
   homekit events list --limit 50 --format json
   ```

3. Narrow to exact IDs:

   ```bash
   homekit accessories search "<query>" --format json
   homekit accessories get <accessoryId> --format json
   homekit scenes get <sceneId> --format json
   homekit automations get <automationId> --format json
   ```

4. Before a write, inspect the exact command schema:

   ```bash
   homekit accessories control --schema --format json
   homekit rooms rename --schema --format json
   ```

5. Verify with the narrowest relevant read and recent events:

   ```bash
   homekit accessories get <accessoryId> --format json
   homekit events list --limit 20 --format json
   ```

## Scenario Routing

- **Initial setup or “is it working?”**: read `setup-and-troubleshooting.md`, run the readiness script or `bridge setup`, then confirm `status`.
- **Inventory or mapping request**: read `inspection-workflows.md`; prefer `device-map` for broad topology and `get` commands for exact details.
- **Unexpected automation/device behavior**: read `inspection-workflows.md`; compare `events list`, `automations list/get`, scenes, and affected accessories before proposing writes.
- **Physical control request**: read `write-workflows.md`; require exact accessory id, characteristic, value, and explicit actuation approval.
- **Home structure change**: read `write-workflows.md`; require exact ids and `--allow-mutation`; prefer disable over delete when undo risk is unclear.
- **Command uncertainty**: read `command-groups.md`, then ask the CLI for help/schema.
