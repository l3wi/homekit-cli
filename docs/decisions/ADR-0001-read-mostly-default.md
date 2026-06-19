# ADR-0001: Read-Mostly Default

## Decision

The default CLI and MCP posture is read-mostly inspection. Physical control exists only through an explicit `accessories control` command requiring `--allow-actuation`.

Structural HomeKit mutations are allowed for deliberate workflows, but they must use specific command names and exact identifiers, and they must require `--allow-mutation`.

Webhook triggers and external callback routing are excluded from the default surface.

## Consequence

Agents can safely inspect topology and state without hidden writes. Control and structural mutation remain available for deliberate workflows, with separate confirmation flags and bridge-side audit entries.
