# Command Groups

Use this as a compact map. Use `homekit --help`, `homekit <group> --help`, and `homekit <command> --schema --format json` for the authoritative command shape.

## Read-Only

- `status`: bridge and HomeKit readiness summary.
- `homes list`: visible homes.
- `rooms list`: rooms and accessory counts.
- `accessories list|get|search`: accessory inventory and details.
- `scenes list|get`: scene inventory and details.
- `automations list|get`: automation inventory and details.
- `zones list`: zone inventory.
- `events list`: recent bridge-observed events.
- `device-map`: topology-oriented map for agents.
- `bridge status|logs`: bridge capabilities and log command.

## Physical Actuation

- `accessories control`: exact accessory id, characteristic, value, and `--allow-actuation`.

## Structural Mutations

- `rooms create|rename|remove|assign`
- `zones create|remove|add-room|remove-room`
- `accessories remove`
- `scenes import|update|delete`
- `automations create|create-time|delete|enable|disable|rewire|add-condition`
- `rename`

All structural mutations require `--allow-mutation`.

## Agent Surfaces

- `--mcp`: stdio MCP server.
- `mcp add`: register the MCP server.
- `--llms`: compact command manifest.
- `<command> --schema --format json`: exact schema for a command.

## Implementation Caveats

The CLI/MCP schema may expose commands before the native bridge writer is complete. Current bridge caveats:

- `scenes import`: may return `NOT_IMPLEMENTED`.
- `scenes update`: may return `NOT_IMPLEMENTED`.
- `automations create`: may return `NOT_IMPLEMENTED`.
- `automations create-time`: may return `NOT_IMPLEMENTED`.
- `automations add-condition`: may return `NOT_IMPLEMENTED`.

Report `NOT_IMPLEMENTED` honestly and stop; do not simulate the change.
