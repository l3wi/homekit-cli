import { Cli, z } from "incur";
import type {
  AccessorySummary,
  ControlResult,
  MutationResult,
} from "../protocol.js";

import { BridgeClient } from "../lib/bridge-client.js";
import { requireActuationAllowed } from "../lib/actuation.js";
import { requireMutationAllowed } from "../lib/mutation.js";
import {
  accessorySummary,
  homeOption,
  mutationOptions,
  mutationResult,
} from "./schemas.js";

const idArg = z.object({
  accessoryId: z.string().describe("Exact HomeKit accessory UUID."),
});

export function accessoriesCommand() {
  return Cli.create("accessories", {
    description:
      "Inspect HomeKit accessories, services, and characteristics; exact-id control requires --allow-actuation and removal requires --allow-mutation.",
  })
    .command("list", {
      description: "List accessories. This is read-only.",
      options: homeOption.extend({
        room: z.string().optional().describe("Filter by room name."),
        category: z
          .string()
          .optional()
          .describe("Filter by category, e.g. garage_door, lock, lightbulb."),
      }),
      output: z.object({ accessories: z.array(accessorySummary) }),
      async run(c) {
        const accessories = await new BridgeClient().call<AccessorySummary[]>(
          "accessories.list",
          c.options,
        );
        return c.ok(
          { accessories },
          {
            cta: {
              commands: accessories.slice(0, 3).map((accessory) => ({
                command: "accessories get",
                args: { accessoryId: accessory.id },
                description: `Inspect ${accessory.name}`,
              })),
            },
          },
        );
      },
    })
    .command("get", {
      description:
        "Get one accessory with services and characteristics. This is read-only.",
      args: idArg,
      options: z.object({
        noRefresh: z
          .boolean()
          .default(false)
          .describe("Use cached state where available."),
      }),
      output: z.object({
        accessory: accessorySummary.extend({
          services: z.array(z.unknown()).optional(),
        }),
      }),
      async run(c) {
        return {
          accessory: await new BridgeClient().call<AccessorySummary>(
            "accessories.get",
            {
              accessoryId: c.args.accessoryId,
              noRefresh: c.options.noRefresh,
            },
          ),
        };
      },
    })
    .command("search", {
      description:
        "Search accessories by name, room, or category. This is read-only.",
      args: z.object({
        query: z.string().describe("Search query."),
      }),
      options: z.object({
        category: z.string().optional().describe("Optional category filter."),
      }),
      output: z.object({ accessories: z.array(accessorySummary) }),
      async run(c) {
        return {
          accessories: await new BridgeClient().call<AccessorySummary[]>(
            "accessories.search",
            {
              query: c.args.query,
              category: c.options.category,
            },
          ),
        };
      },
    })
    .command("control", {
      description:
        "Set one characteristic on one exact accessory. Requires --allow-actuation and writes an audit entry.",
      args: idArg.extend({
        characteristic: z
          .string()
          .describe("Characteristic alias or type to set."),
        value: z.string().describe("Value to set, encoded as a string."),
      }),
      options: z.object({
        serviceType: z
          .string()
          .optional()
          .describe("Service type when the characteristic is ambiguous."),
        allowActuation: z
          .boolean()
          .default(false)
          .describe("Required. Confirms a physical device may change."),
      }),
      output: z.object({
        auditId: z.string(),
        accessoryId: z.string(),
        characteristic: z.string(),
        accepted: z.boolean(),
        dryRun: z.literal(false),
      }),
      async run(c) {
        requireActuationAllowed(c.options.allowActuation);
        return new BridgeClient().control({
          accessoryId: c.args.accessoryId,
          characteristic: c.args.characteristic,
          value: c.args.value,
          serviceType: c.options.serviceType,
          allowActuation: c.options.allowActuation,
        }) as Promise<ControlResult>;
      },
    })
    .command("remove", {
      description:
        "Remove one accessory from HomeKit. Requires --allow-mutation.",
      args: idArg,
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("accessories.remove", {
          ...c.args,
          ...c.options,
        });
      },
    });
}
