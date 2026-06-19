# Inspection Workflows

Use this reference for read-only HomeKit investigation, inventory, mapping, and unexpected-device behavior.

## Inventory Baseline

Start broad, then narrow:

```bash
homekit status --json
homekit device-map --json
homekit accessories list --json
homekit rooms list --json
homekit zones list --json
homekit scenes list --json
homekit automations list --json
homekit events list --limit 100 --json
```

Use `device-map` when an agent needs topology and characteristic names. Use `accessories get`, `scenes get`, or `automations get` when a specific id is known.

## Finding A Target

Search names first, then inspect exact candidates:

```bash
homekit accessories search "<query>" --json
homekit accessories get <accessoryId> --json
```

If more than one candidate could match, stop and ask the user to choose. Do not infer a safety-critical target from a fuzzy name.

## Unexpected Behavior Investigation

For issues like “unlocking the gate opens the garage”:

1. Pull recent events:

   ```bash
   homekit events list --limit 200 --json
   ```

2. Inspect affected accessories:

   ```bash
   homekit accessories search "gate" --json
   homekit accessories search "garage" --json
   homekit accessories get <gateAccessoryId> --json
   homekit accessories get <garageAccessoryId> --json
   ```

3. Inspect scenes and automations:

   ```bash
   homekit scenes list --json
   homekit automations list --json
   homekit automations get <automationId> --json
   ```

4. Correlate by timestamp, target accessory id, scene id, automation id, and characteristic. Prefer reporting evidence over guessing.

## Event Log Use

Use events to prove what the bridge observed, not as the sole source of HomeKit truth. Pair event logs with current `get` output for the affected accessory, scene, or automation.

When reporting, include:

- exact command run
- relevant id/name
- timestamp from the event
- whether the evidence shows correlation, causation, or only coincidence

## Read-Only Guardrail

Do not use `control`, `remove`, `rename`, `create`, `delete`, `enable`, `disable`, `rewire`, `assign`, `import`, or `update` while doing inspection unless the user explicitly changes the task into a write.
