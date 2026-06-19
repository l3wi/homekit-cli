# MCP

Incur exposes the CLI command tree as MCP tools.

Run MCP without a global install:

```bash
npx -y homekit-cli --mcp
```

Register MCP without a global install:

```bash
npx homekit-cli mcp add
```

If installed globally:

```bash
homekit --mcp
homekit mcp add
homekit --llms
```

HomeClaw must be installed first because HomeKit requires an entitlement-bearing App Store or TestFlight app. Install [HomeClaw from the Mac App Store](https://apps.apple.com/us/app/homeclaw/id6759682551?mt=12), launch it once, and approve HomeKit permission.

Skip HomeClaw's bundled CLI and MCP setup. It owns native HomeKit access; this package owns the documented MCP surface, command schemas, examples, and skills.

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

Both examples expose the same MCP server. HomeKit writes are still gated by command schemas and provider-side checks; the profile label is for agent/operator clarity, not a permission bypass.

For users running through npm without a global install, setup should be:

```bash
npx homekit-cli bridge setup
npx homekit-cli mcp add
```

The MCP server command without a global install is:

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

Webhook and trigger commands are part of the MCP surface. Webhook setup, reset, purge, and trigger mutations require `allowMutation`.
