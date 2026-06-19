# Mutate HomeKit State

Use this runbook when changing rooms, zones, scenes, automations, accessory membership, or names.

## Preconditions

1. Confirm the provider is ready:

```bash
homekit status --format json
```

2. Identify exact targets:

```bash
homekit homes list --format json
homekit rooms list --format json
homekit accessories search <query> --format json
homekit scenes list --format json
homekit automations list --format json
homekit zones list --format json
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

## Provider Support

Use mutation commands only after checking provider capabilities and exact schemas:

- room create, rename, remove, assign
- zone create, remove, add-room, remove-room
- scene trigger, import, update, delete
- automation create, create-time, delete, enable, disable, rewire, add-condition
- accessory remove
- webhook setup, reset, purge-log
- trigger add, update, remove
- generic rename
