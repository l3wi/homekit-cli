# Write Workflows

Use this reference only after the user asks for a specific physical actuation or HomeKit structural change.

## Preflight

Before any write:

1. Confirm the target with a read-only command.
2. Inspect the exact write command schema.
3. Use exact ids and exact values.
4. Include the required safety flag.
5. Verify the result with a narrow read and recent events.

Schema examples:

```bash
homekit accessories control --schema --format json
homekit rooms rename --schema --format json
homekit automations disable --schema --format json
```

## Accessory Control

Physical device control requires explicit actuation:

```bash
homekit accessories control <accessoryId> <characteristic> <value> --allow-actuation --json
```

Never control a garage door, gate, lock, security system, cover, or camera-related target unless the user’s request names that exact action.

After control, verify:

```bash
homekit accessories get <accessoryId> --json
homekit events list --limit 20 --json
```

Report `auditId` if returned.

## Rooms And Zones

Structural changes require mutation approval:

```bash
homekit rooms create "<name>" --allow-mutation --json
homekit rooms rename <roomId> "<newName>" --allow-mutation --json
homekit rooms assign <accessoryId> <roomId> --allow-mutation --json
homekit zones add-room <zoneId> <roomId> --allow-mutation --json
```

Verify with `rooms list`, `zones list`, and the affected accessory `get`.

## Scenes

Read first:

```bash
homekit scenes list --json
homekit scenes get <sceneId> --json
```

Mutations require `--allow-mutation`. `scenes delete` is implemented. `scenes import` and `scenes update` may return `NOT_IMPLEMENTED` until the bridge writer is finished; report that directly.

## Automations

Prefer disable before delete when remediation is uncertain:

```bash
homekit automations disable <automationId> --allow-mutation --json
homekit automations enable <automationId> --allow-mutation --json
homekit automations delete <automationId> --allow-mutation --json
homekit automations rewire <automationId> --add-scene-ids <sceneId> --allow-mutation --json
```

`automations create`, `create-time`, and `add-condition` may return `NOT_IMPLEMENTED`; do not fake success.

## Generic Rename And Removal

Use `rename` for supported object kinds only after exact-id confirmation:

```bash
homekit rename accessory <accessoryId> "<newName>" --allow-mutation --json
```

Accessory removal is destructive:

```bash
homekit accessories remove <accessoryId> --allow-mutation --json
```

Ask for confirmation before removing safety-critical accessories or anything with unclear ownership.

## Reporting Writes

Always report:

- target kind, name, and id
- command family used
- requested change
- whether the bridge accepted it
- `auditId` if returned
- verification command and result
