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
homekit accessories control <accessoryId> <characteristic> <value> --allow-actuation --format json
```

Never control a garage door, gate, lock, security system, cover, or camera-related target unless the user’s request names that exact action.

After control, verify:

```bash
homekit accessories get <accessoryId> --format json
homekit events list --limit 20 --format json
```

Report `auditId` if returned.

## Rooms And Zones

Structural changes require mutation approval:

```bash
homekit rooms create "<name>" --allow-mutation --format json
homekit rooms rename <roomId> "<newName>" --allow-mutation --format json
homekit rooms assign <accessoryId> <roomId> --allow-mutation --format json
homekit zones add-room <zoneId> <roomId> --allow-mutation --format json
```

Verify with `rooms list`, `zones list`, and the affected accessory `get`.

## Scenes

Read first:

```bash
homekit scenes list --format json
homekit scenes get <sceneId> --format json
```

Mutations require `--allow-mutation`. HomeClaw may return unsupported-operation errors for some operations; report that directly.

Running a scene is physical actuation because it can change multiple devices:

```bash
homekit scenes trigger <sceneId> --allow-actuation --format json
```

Before triggering a scene, inspect it with `scenes get` and name any safety-critical accessories it may affect.

## Automations

Prefer disable before delete when remediation is uncertain:

```bash
homekit automations disable <automationId> --allow-mutation --format json
homekit automations enable <automationId> --allow-mutation --format json
homekit automations delete <automationId> --allow-mutation --format json
homekit automations rewire <automationId> --add-scene-ids <sceneId> --allow-mutation --format json
```

`automations create`, `create-time`, and `add-condition` may return `NOT_IMPLEMENTED`; do not fake success.

## Webhooks And Triggers

Webhook configuration and trigger selection require mutation approval:

```bash
homekit webhooks setup http://127.0.0.1:18789 --allow-mutation --format json
homekit triggers add "Front gate events" --allow-mutation --format json
homekit triggers remove <triggerId> --allow-mutation --format json
```

Read-only checks:

```bash
homekit webhooks status --format json
homekit webhooks log --limit 20 --format json
homekit triggers list --format json
```

## Generic Rename And Removal

Use `rename` for supported object kinds only after exact-id confirmation:

```bash
homekit rename accessory <accessoryId> "<newName>" --allow-mutation --format json
```

Accessory removal is destructive:

```bash
homekit accessories remove <accessoryId> --allow-mutation --format json
```

Ask for confirmation before removing safety-critical accessories or anything with unclear ownership.

## Reporting Writes

Always report:

- target kind, name, and id
- command family used
- requested change
- whether the provider accepted it
- `auditId` if returned
- verification command and result
