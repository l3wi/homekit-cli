import { Cli, z } from "incur";
import type { MutationResult } from "../protocol.js";

import { BridgeClient } from "../lib/bridge-client.js";
import { requireMutationAllowed } from "../lib/mutation.js";
import { homeOption, mutationOptions, mutationResult } from "./schemas.js";

export function renameCommand() {
  return Cli.create("rename", {
    description:
      "Rename one HomeKit accessory, room, zone, scene, or automation by exact identifier. Requires --allow-mutation.",
    args: z.object({
      kind: z.enum(["accessory", "room", "zone", "scene", "automation"]),
      id: z.string().describe("UUID or exact name."),
      newName: z.string().describe("New name."),
    }),
    options: homeOption.merge(mutationOptions),
    output: mutationResult,
    async run(c) {
      requireMutationAllowed(c.options.allowMutation);
      return new BridgeClient().call<MutationResult>("rename", {
        ...c.args,
        ...c.options,
      });
    },
  });
}
