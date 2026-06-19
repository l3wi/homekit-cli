# Inspect Home

Use read-only commands first:

```bash
homekit status --json
homekit homes list --json
homekit rooms list --json
homekit accessories list --json
homekit accessories search garage --json
homekit accessories get <accessoryId> --json
homekit scenes list --json
homekit automations list --json
homekit zones list --json
homekit events list --json
homekit device-map --json
```

Do not run `accessories control` unless the user explicitly asks to actuate the selected device. Do not run mutation commands unless the user explicitly asks to change HomeKit structure or automation state.

Mutation commands require `--allow-mutation`; actuation requires `--allow-actuation`.
