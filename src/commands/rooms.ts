import { Cli, z } from "incur";
import type { MutationResult, RoomSummary } from "../protocol.js";

import { BridgeClient } from "../lib/bridge-client.js";
import { requireMutationAllowed } from "../lib/mutation.js";
import {
  homeOption,
  mutationOptions,
  mutationResult,
  roomSummary,
} from "./schemas.js";

export function roomsCommand() {
  return Cli.create("rooms", {
    description:
      "Inspect rooms and accessory placement; create, rename, remove, or assign accessories only with --allow-mutation.",
  })
    .command("list", {
      description: "List rooms and accessory counts.",
      options: homeOption,
      output: z.object({ rooms: z.array(roomSummary) }),
      async run(c) {
        return {
          rooms: await new BridgeClient().call<RoomSummary[]>(
            "rooms.list",
            c.options,
          ),
        };
      },
    })
    .command("create", {
      description: "Create a room. Requires --allow-mutation.",
      args: z.object({ name: z.string().describe("New room name.") }),
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("rooms.create", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("rename", {
      description: "Rename a room. Requires --allow-mutation.",
      args: z.object({
        roomId: z.string().describe("Room UUID or exact name."),
        newName: z.string().describe("New room name."),
      }),
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("rooms.rename", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("remove", {
      description: "Remove a room. Requires --allow-mutation.",
      args: z.object({
        roomId: z.string().describe("Room UUID or exact name."),
      }),
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("rooms.remove", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("assign", {
      description:
        "Assign one accessory to one room. Requires --allow-mutation.",
      args: z.object({
        accessoryId: z.string().describe("Accessory UUID or exact name."),
        roomId: z.string().describe("Room UUID or exact name."),
      }),
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("rooms.assign", {
          ...c.args,
          ...c.options,
        });
      },
    });
}
