import { Cli, z } from "incur";

import { bridgeInstallHint, BridgeClient } from "../lib/bridge-client.js";
import { resolveSocketPath } from "../lib/socket-path.js";

export function bridgeCommand() {
  return Cli.create("bridge", {
    description:
      "Set up, launch, inspect, stop, and debug the configured HomeKit provider.",
  })
    .command("setup", {
      description:
        "Verify provider installation, launch it, check compatibility, and print next steps.",
      output: z.object({
        socketPath: z.string(),
        reachable: z.boolean(),
        capabilities: z.unknown().optional(),
        mcp: z.object({ command: z.string(), args: z.array(z.string()) }),
        skills: z.object({ command: z.string(), args: z.array(z.string()) }),
        installHint: z.unknown(),
      }),
      async run(c) {
        const client = new BridgeClient({ autoLaunch: true });
        const capabilities = await client.capabilities();
        return c.ok(
          {
            socketPath: client.socketPath,
            reachable: true,
            capabilities,
            mcp: { command: "npx", args: ["-y", "homekit-cli", "--mcp"] },
            skills: {
              command: "npx",
              args: ["skills", "add", "l3wi/homekit-cli", "--skill", "homekit"],
            },
            installHint: bridgeInstallHint(),
          },
          {
            cta: {
              commands: [
                {
                  command: "mcp add",
                  description:
                    "Register this CLI as an MCP server with supported agents",
                },
                { command: "status", description: "Confirm HomeKit readiness" },
              ],
            },
          },
        );
      },
    })
    .command("status", {
      description: "Show raw provider capabilities and resolved socket path.",
      output: z.object({
        socketPath: z.string(),
        capabilities: z.unknown(),
      }),
      async run() {
        const client = new BridgeClient({ autoLaunch: false });
        return {
          socketPath: client.socketPath,
          capabilities: await client.capabilities(),
        };
      },
    })
    .command("launch", {
      description: "Launch the configured provider and wait for its socket.",
      output: z.object({ socketPath: z.string(), launched: z.boolean() }),
      async run() {
        const client = new BridgeClient({ autoLaunch: false });
        await client.launchBridge();
        return { socketPath: client.socketPath, launched: true };
      },
    })
    .command("stop", {
      description: "Ask the configured provider to stop cleanly.",
      output: z.object({ stopped: z.boolean() }),
      async run() {
        await new BridgeClient({ autoLaunch: false }).call("bridge.stop");
        return { stopped: true };
      },
    })
    .command("logs", {
      description: "Print the unified-log command for following provider logs.",
      output: z.object({ command: z.string(), socketPath: z.string() }),
      run() {
        return {
          command:
            'log stream --info --predicate \'process CONTAINS "HomeClaw" OR process CONTAINS "homekit"\'',
          socketPath: resolveSocketPath(),
        };
      },
    });
}
