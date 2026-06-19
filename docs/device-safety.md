# Device Safety

Read-only commands include:

- `homekit status`
- `homekit homes list`
- `homekit rooms list`
- `homekit accessories list`
- `homekit accessories get`
- `homekit accessories search`
- `homekit scenes list`
- `homekit scenes get`
- `homekit automations list`
- `homekit automations get`
- `homekit zones list`
- `homekit events list`
- `homekit device-map`

Actuation commands:

- `homekit accessories control <accessoryId> <characteristic> <value> --allow-actuation`
- `homekit scenes trigger <sceneId> --allow-actuation`

Use exact accessory identifiers for actuation. Do not actuate by broad name, category, room, or search result without a human explicitly choosing the target.

Structural mutation commands require `--allow-mutation`:

- room create, rename, remove, assign
- zone create, remove, add-room, remove-room
- scene delete, import, update
- automation create, create-time, delete, enable, disable, rewire, add-condition
- accessory remove
- generic rename
- webhook setup, reset, purge-log
- trigger add, update, remove

Use `--dry-run` where available before applying structural changes. Provider-side audit behavior depends on the configured provider.

Webhook configuration and trigger selection are exposed because HomeClaw owns the delivery path. This project does not expose its own webhook listener or external callback routing layer.
