import { Cli, z } from "incur";
import type { MutationResult, ZoneSummary } from "../protocol.js";

import { BridgeClient } from "../lib/bridge-client.js";
import { requireMutationAllowed } from "../lib/mutation.js";
import {
  homeOption,
  mutationOptions,
  mutationResult,
  zoneSummary,
} from "./schemas.js";

const zoneIdArg = z.object({
  zoneId: z.string().describe("Zone UUID or exact name."),
});

export function zonesCommand() {
  return Cli.create("zones", {
    description:
      "Inspect and manage HomeKit zones that group rooms; create/remove zones or edit room membership only with --allow-mutation.",
  })
    .command("list", {
      description: "List zones and room counts. This is read-only.",
      options: homeOption,
      output: z.object({ zones: z.array(zoneSummary) }),
      async run(c) {
        return {
          zones: await new BridgeClient().call<ZoneSummary[]>(
            "zones.list",
            c.options,
          ),
        };
      },
    })
    .command("create", {
      description: "Create a zone. Requires --allow-mutation.",
      args: z.object({ name: z.string().describe("New zone name.") }),
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("zones.create", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("remove", {
      description: "Remove a zone. Requires --allow-mutation.",
      args: zoneIdArg,
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("zones.remove", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("add-room", {
      description: "Add a room to a zone. Requires --allow-mutation.",
      args: zoneIdArg.extend({
        roomId: z.string().describe("Room UUID or exact name."),
      }),
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("zones.addRoom", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("remove-room", {
      description: "Remove a room from a zone. Requires --allow-mutation.",
      args: zoneIdArg.extend({
        roomId: z.string().describe("Room UUID or exact name."),
      }),
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("zones.removeRoom", {
          ...c.args,
          ...c.options,
        });
      },
    });
}
