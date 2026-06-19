# Inspect Home

Use read-only commands first:

```bash
homekit status --format json
homekit homes list --format json
homekit rooms list --format json
homekit accessories list --format json
homekit accessories search garage --format json
homekit accessories get <accessoryId> --format json
homekit scenes list --format json
homekit automations list --format json
homekit zones list --format json
homekit events list --format json
homekit device-map --format json
```

Do not run `accessories control` unless the user explicitly asks to actuate the selected device. Do not run mutation commands unless the user explicitly asks to change HomeKit structure or automation state.

Mutation commands require `--allow-mutation`; actuation requires `--allow-actuation`.
