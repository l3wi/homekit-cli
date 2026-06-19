# ADR-0003: Incur Command Tree As MCP Source

## Decision

Use Incur as the CLI source of truth. Do not maintain a separate MCP schema/server by hand.

## Consequence

Command schemas, human help, `--llms`, `--mcp`, and `mcp add` stay aligned.

Agent skills are intentionally excluded from this generated surface; see ADR-0005.
