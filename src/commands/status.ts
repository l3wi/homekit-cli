import { Cli } from "incur";
import type { Status } from "../protocol.js";

import { BridgeClient } from "../lib/bridge-client.js";
import { statusOutput } from "./schemas.js";

export function statusCommand() {
  return Cli.create("status", {
    description:
      "Show provider connectivity, HomeKit permission readiness, protocol compatibility, socket path, and cache status.",
    output: statusOutput,
    async run(c) {
      const status = await new BridgeClient().call<Status>("status");
      return c.ok(status, {
        cta: {
          commands: [
            {
              command: "homes list",
              description: "List HomeKit homes visible to the provider",
            },
            {
              command: "accessories list",
              description: "List accessories after confirming readiness",
            },
          ],
        },
      });
    },
  });
}
