# Commands

This is the command reference for the CLI and MCP surface. Incur exposes the same command tree to humans and agents, so every command here is also part of the MCP tool surface unless noted by runtime availability.

## Safety Flags

`--allow-actuation` is required for physical device state changes:

```bash
homekit accessories control <accessoryId> <characteristic> <value> --allow-actuation
```

`--allow-mutation` is required for structural HomeKit changes:

```bash
homekit rooms rename <roomId> <newName> --allow-mutation
```

Most mutation commands also accept `--dry-run` to validate and preview without applying.

## Read-Only Commands

- `homekit status`: bridge connectivity, HomeKit readiness, and cache status.
- `homekit homes list`: homes visible to the signed bridge app.
- `homekit rooms list`: rooms and accessory counts.
- `homekit accessories list`: accessories.
- `homekit accessories get <accessoryId>`: one accessory with services and characteristics.
- `homekit accessories search <query>`: accessory search by name, room, category, manufacturer, or model.
- `homekit scenes list`: scenes/action sets.
- `homekit scenes get <sceneId>`: one scene/action set.
- `homekit automations list`: HomeKit automations.
- `homekit automations get <automationId>`: one HomeKit automation.
- `homekit zones list`: zones and room counts.
- `homekit events list`: recent events observed by the bridge.
- `homekit device-map`: LLM-friendly home, room, accessory, and characteristic map.
- `homekit bridge status`: raw bridge capabilities and resolved socket path.
- `homekit bridge logs`: print the unified-log command for bridge logs.

## Actuation

- `homekit accessories control <accessoryId> <characteristic> <value> --allow-actuation`

Actuation requires an exact accessory identifier, a characteristic alias or type, and an explicit value. The bridge writes an audit entry for accepted and rejected actuation requests.

## Structural Mutations

Rooms:

- `homekit rooms create <name> --allow-mutation`
- `homekit rooms rename <roomId> <newName> --allow-mutation`
- `homekit rooms remove <roomId> --allow-mutation`
- `homekit rooms assign <accessoryId> <roomId> --allow-mutation`

Zones:

- `homekit zones create <name> --allow-mutation`
- `homekit zones remove <zoneId> --allow-mutation`
- `homekit zones add-room <zoneId> <roomId> --allow-mutation`
- `homekit zones remove-room <zoneId> <roomId> --allow-mutation`

Accessories:

- `homekit accessories remove <accessoryId> --allow-mutation`

Scenes:

- `homekit scenes delete <sceneId> --allow-mutation`
- `homekit scenes import <name> --actions '[...]' --allow-mutation`
- `homekit scenes update <sceneId> --actions '[...]' --allow-mutation`

Generic rename:

- `homekit rename <kind> <id> <newName> --allow-mutation`

Supported rename kinds:

```text
accessory
room
zone
scene
automation
```

## Automations

Read-only:

- `homekit automations list`
- `homekit automations get <automationId>`

Mutating:

- `homekit automations create --name <name> --accessory-id <accessoryId> ... --allow-mutation`
- `homekit automations create-time --name <name> --time <time> ... --allow-mutation`
- `homekit automations delete <automationId> --allow-mutation`
- `homekit automations enable <automationId> --allow-mutation`
- `homekit automations disable <automationId> --allow-mutation`
- `homekit automations rewire <automationId> --add-scene-ids <sceneId> --allow-mutation`
- `homekit automations add-condition <automationId> <accessoryId> <characteristic> <value> --allow-mutation`

## Bridge Management

- `homekit bridge setup`: verify bridge installation, launch it, check protocol compatibility, and print next steps.
- `homekit bridge launch`: launch the bridge app and wait for its socket.
- `homekit bridge stop`: ask the bridge to stop cleanly.
- `homekit bridge status`: show bridge capabilities.
- `homekit bridge logs`: print a `log stream` command.

## MCP And Agent Discovery

- `homekit --mcp`: start MCP stdio server.
- `homekit mcp add`: register the MCP server.
- `homekit --llms`: print LLM-readable command manifest.
- `homekit <command> --schema --format json`: inspect a command schema.

The internal Incur `homekit skills` command is disabled for this package. Install the curated workflow skill with:

```bash
npx skills add l3wi/homekit-cli --skill homekit
```

## Implementation Status

Implemented in the bridge:

- read-only commands
- accessory control
- accessory remove
- room create, rename, remove, assign
- zone list, create, remove, add-room, remove-room
- scene delete
- automation list, get, delete, enable, disable, rewire
- generic rename

Present in CLI/MCP schema but currently returns `NOT_IMPLEMENTED` from the bridge:

- `homekit scenes import`
- `homekit scenes update`
- `homekit automations create`
- `homekit automations create-time`
- `homekit automations add-condition`

Excluded intentionally:

- webhook triggers
- webhook listeners
- external callback routing
- TUI or app UI workflows
