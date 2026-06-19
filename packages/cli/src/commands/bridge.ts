import { Cli, z } from "incur";

import { bridgeInstallHint, BridgeClient } from "../lib/bridge-client.js";
import { resolveSocketPath } from "../lib/socket-path.js";

export function bridgeCommand() {
  return Cli.create("bridge", {
    description:
      "Set up, launch, inspect, stop, and debug the signed HomeKit Bridge app that owns HomeKit permission and the local socket.",
  })
    .command("setup", {
      description:
        "Verify bridge installation, launch it, check protocol compatibility, and print next steps.",
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
            mcp: { command: "homekit", args: ["--mcp"] },
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
                {
                  command: "npx skills add l3wi/homekit-cli --skill homekit",
                  description:
                    "Install the canonical HomeKit workflow skill for agents",
                },
                { command: "status", description: "Confirm HomeKit readiness" },
              ],
            },
          },
        );
      },
    })
    .command("status", {
      description: "Show raw bridge capabilities and resolved socket path.",
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
      description: "Launch the bridge app and wait for its socket.",
      output: z.object({ socketPath: z.string(), launched: z.boolean() }),
      async run() {
        const client = new BridgeClient({ autoLaunch: false });
        await client.launchBridge();
        return { socketPath: client.socketPath, launched: true };
      },
    })
    .command("stop", {
      description: "Ask the bridge to stop cleanly.",
      output: z.object({ stopped: z.boolean() }),
      async run() {
        await new BridgeClient({ autoLaunch: false }).call("bridge.stop");
        return { stopped: true };
      },
    })
    .command("logs", {
      description: "Print the unified-log command for following bridge logs.",
      output: z.object({ command: z.string(), socketPath: z.string() }),
      run() {
        return {
          command:
            'log stream --info --predicate \'subsystem == "ad.blackwattle.homekit" OR process == "HomeKit Bridge"\'',
          socketPath: resolveSocketPath(),
        };
      },
    });
}
