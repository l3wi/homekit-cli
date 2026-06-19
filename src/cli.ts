import { Cli, z } from "incur";

import { accessoriesCommand } from "./commands/accessories.js";
import { automationsCommand } from "./commands/automations.js";
import { bridgeCommand } from "./commands/bridge.js";
import { deviceMapCommand } from "./commands/device-map.js";
import { eventsCommand } from "./commands/events.js";
import { homesCommand } from "./commands/homes.js";
import { renameCommand } from "./commands/rename.js";
import { roomsCommand } from "./commands/rooms.js";
import { scenesCommand } from "./commands/scenes.js";
import { statusCommand } from "./commands/status.js";
import { triggersCommand } from "./commands/triggers.js";
import { webhooksCommand } from "./commands/webhooks.js";
import { zonesCommand } from "./commands/zones.js";

export const cli = Cli.create("homekit", {
  version: "0.1.1",
  description:
    "Use homekit-cli safely for HomeKit setup, inspection, read-only inventory, explicit device control, structural mutations, scenes, automations, MCP setup, and troubleshooting.",
  env: z.object({
    HOMEKIT_SOCKET_PATH: z
      .string()
      .optional()
      .describe("Override the HomeClaw Unix socket path."),
    HOMEKIT_USE_LEGACY_TMP_SOCKET: z
      .string()
      .optional()
      .describe("Set to 1 to use /tmp/homeclaw.sock."),
    HOMEKIT_MCP_PROFILE: z
      .enum(["readonly", "write"])
      .optional()
      .describe(
        "Operator-facing MCP profile label. Safety is still enforced by allowActuation and allowMutation.",
      ),
  }),
  mcp: {
    command: "npx -y homekit-cli --mcp",
  },
})
  .command(statusCommand())
  .command(homesCommand())
  .command(roomsCommand())
  .command(accessoriesCommand())
  .command(scenesCommand())
  .command(automationsCommand())
  .command(zonesCommand())
  .command(renameCommand())
  .command(deviceMapCommand())
  .command(eventsCommand())
  .command(webhooksCommand())
  .command(triggersCommand())
  .command(bridgeCommand());

export default cli;
