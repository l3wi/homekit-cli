# Mutate HomeKit State

Use this runbook when changing rooms, zones, scenes, automations, accessory membership, or names.

## Preconditions

1. Confirm the bridge is ready:

```bash
homekit status --json
```

2. Identify exact targets:

```bash
homekit homes list --json
homekit rooms list --json
homekit accessories search <query> --json
homekit scenes list --json
homekit automations list --json
homekit zones list --json
```

3. Prefer UUIDs over names for mutation targets.

## Preview First

Use `--dry-run` where the command supports it:

```bash
homekit rooms rename <roomId> "New Name" --allow-mutation --dry-run
homekit zones add-room <zoneId> <roomId> --allow-mutation --dry-run
homekit automations rewire <automationId> --add-scene-ids <sceneId> --allow-mutation --dry-run
```

## Apply

Re-run without `--dry-run` only after the target and intended effect are clear:

```bash
homekit rooms rename <roomId> "New Name" --allow-mutation
homekit zones add-room <zoneId> <roomId> --allow-mutation
homekit automations disable <automationId> --allow-mutation
```

## Safety Rules

- Do not mutate by broad search result.
- Do not remove rooms, zones, scenes, automations, or accessories without explicit user confirmation.
- Do not use `accessories control` for structural changes; use the relevant mutation command.
- Do not use mutation commands for physical actuation; `accessories control` requires `--allow-actuation`.
- Check the returned `auditId` after every accepted mutation.

## Currently Pending Bridge Implementations

These commands are present in CLI/MCP schemas but currently return `NOT_IMPLEMENTED`:

- `homekit scenes import`
- `homekit scenes update`
- `homekit automations create`
- `homekit automations create-time`
- `homekit automations add-condition`

Use the implemented mutation commands for now:

- room create, rename, remove, assign
- zone create, remove, add-room, remove-room
- scene delete
- automation delete, enable, disable, rewire
- accessory remove
- generic rename
