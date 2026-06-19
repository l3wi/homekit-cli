# MCP

Incur exposes the CLI command tree as MCP tools:

```bash
homekit --mcp
homekit mcp add
homekit --llms
```

Recommended MCP setup:

```json
{
  "mcpServers": {
    "homekit": {
      "command": "homekit",
      "args": ["--mcp"]
    }
  }
}
```

Example files:

- `examples/mcp.readonly.example.json`: recommended default profile for inspection-first agents.
- `examples/mcp.write.example.json`: write-capable profile for agents that may pass explicit `allowActuation=true` or `allowMutation=true`.

Both examples expose the same MCP server. HomeKit writes are still gated by command schemas and bridge-side checks; the profile label is for agent/operator clarity, not a permission bypass.

For users installing through npm, setup should be:

```bash
npx homekit-cli bridge setup
npx homekit-cli mcp add
```

The MCP server command is:

```bash
npx -y homekit-cli --mcp
```

The MCP surface is the CLI command tree. It includes read-only inspection, explicit actuation, and structural HomeKit mutation commands.

Safety gates still apply through MCP:

- `accessories control` requires `allowActuation=true`.
- room, zone, scene, automation, accessory removal, and rename mutations require `allowMutation=true`.
- exact identifiers are required for mutation targets.

Agents should use the external Skills CLI to install the canonical `homekit` skill:

```bash
npx skills add l3wi/homekit-cli --skill homekit
```

Local development from the repo root:

```bash
npx skills add ./skills --skill homekit --copy -y
```

The skill covers setup, inspection, read-only inventory, explicit writes, scenes, automations, and safety checks. Use `homekit --llms` or `homekit <command> --schema --format json` for command-reference details instead of relying on generated skill text. The internal Incur `homekit skills` command is disabled for this package.

Webhook triggers are not part of the MCP surface.
