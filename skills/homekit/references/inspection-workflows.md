# Inspection Workflows

Use this reference for read-only HomeKit investigation, inventory, mapping, and unexpected-device behavior.

## Inventory Baseline

Start broad, then narrow:

```bash
homekit status --format json
homekit device-map --format json
homekit accessories list --format json
homekit rooms list --format json
homekit zones list --format json
homekit scenes list --format json
homekit automations list --format json
homekit events list --limit 100 --format json
```

Use `device-map` when an agent needs topology and characteristic names. Use `accessories get`, `scenes get`, or `automations get` when a specific id is known.

## Finding A Target

Search names first, then inspect exact candidates:

```bash
homekit accessories search "<query>" --format json
homekit accessories get <accessoryId> --format json
```

If more than one candidate could match, stop and ask the user to choose. Do not infer a safety-critical target from a fuzzy name.

## Unexpected Behavior Investigation

For issues like “unlocking the gate opens the garage”:

1. Pull recent events:

   ```bash
   homekit events list --limit 200 --format json
   ```

2. Inspect affected accessories:

   ```bash
   homekit accessories search "gate" --format json
   homekit accessories search "garage" --format json
   homekit accessories get <gateAccessoryId> --format json
   homekit accessories get <garageAccessoryId> --format json
   ```

3. Inspect scenes and automations:

   ```bash
   homekit scenes list --format json
   homekit automations list --format json
   homekit automations get <automationId> --format json
   ```

4. Correlate by timestamp, target accessory id, scene id, automation id, and characteristic. Prefer reporting evidence over guessing.

## Event Log Use

Use events to prove what the provider observed, not as the sole source of HomeKit truth. Pair event logs with current `get` output for the affected accessory, scene, or automation.

When reporting, include:

- exact command run
- relevant id/name
- timestamp from the event
- whether the evidence shows correlation, causation, or only coincidence

## Read-Only Guardrail

Do not use `control`, `remove`, `rename`, `create`, `delete`, `enable`, `disable`, `rewire`, `assign`, `import`, or `update` while doing inspection unless the user explicitly changes the task into a write.
