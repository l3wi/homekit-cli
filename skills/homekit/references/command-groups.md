# Command Groups

Use this as a compact map. Use `homekit --help`, `homekit <group> --help`, and `homekit <command> --schema --format json` for the authoritative command shape.

## Read-Only

- `status`: provider and HomeKit readiness summary.
- `homes list`: visible homes.
- `rooms list`: rooms and accessory counts.
- `accessories list|get|search`: accessory inventory and details.
- `scenes list|get`: scene inventory and details.
- `automations list|get`: automation inventory and details.
- `zones list`: zone inventory.
- `events list`: recent provider-observed events.
- `device-map`: topology-oriented map for agents.
- `webhooks status|log|log-stats`: webhook configuration and delivery evidence.
- `triggers list`: HomeClaw webhook trigger selection.
- `bridge status|logs`: provider capabilities and log command.

## Physical Actuation

- `accessories control`: exact accessory id, characteristic, value, and `--allow-actuation`.
- `scenes trigger`: exact scene id/name and `--allow-actuation`.

## Structural Mutations

- `rooms create|rename|remove|assign`
- `zones create|remove|add-room|remove-room`
- `accessories remove`
- `scenes import|update|delete`
- `automations create|create-time|delete|enable|disable|rewire|add-condition`
- `webhooks setup|reset|purge-log`
- `triggers add|update|remove`
- `rename`

All structural mutations require `--allow-mutation`.

## Agent Surfaces

- `--mcp`: stdio MCP server.
- `mcp add`: register the MCP server.
- `--llms`: compact command manifest.
- `<command> --schema --format json`: exact schema for a command.
