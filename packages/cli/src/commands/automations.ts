import { Cli, z } from "incur";
import type { AutomationSummary, MutationResult } from "../protocol.js";

import { BridgeClient } from "../lib/bridge-client.js";
import { requireMutationAllowed } from "../lib/mutation.js";
import {
  automationSummary,
  homeOption,
  mutationOptions,
  mutationResult,
} from "./schemas.js";

const automationIdArg = z.object({
  automationId: z.string().describe("Automation UUID or exact name."),
});

const automationAction = z.object({
  accessoryId: z.string().describe("Accessory UUID or exact name."),
  characteristic: z.string().describe("Characteristic alias or type."),
  value: z.string().describe("Target value encoded as a string."),
  serviceType: z.string().optional().describe("Optional service type filter."),
});

const automationCondition = z.object({
  accessoryId: z.string().describe("Accessory UUID or exact name."),
  characteristic: z.string().describe("Characteristic alias or type."),
  value: z.string().describe("Required value encoded as a string."),
  serviceType: z.string().optional().describe("Optional service type filter."),
});

export function automationsCommand() {
  return Cli.create("automations", {
    description:
      "Inspect and manage native HomeKit automations, including enable/disable, scene rewiring, and gated creation/deletion with --allow-mutation.",
  })
    .command("list", {
      description: "List HomeKit automations. This is read-only.",
      options: homeOption,
      output: z.object({ automations: z.array(automationSummary) }),
      async run(c) {
        return {
          automations: await new BridgeClient().call<AutomationSummary[]>(
            "automations.list",
            c.options,
          ),
        };
      },
    })
    .command("get", {
      description: "Inspect one HomeKit automation. This is read-only.",
      args: automationIdArg,
      options: homeOption,
      output: z.object({ automation: z.unknown() }),
      async run(c) {
        return {
          automation: await new BridgeClient().call("automations.get", {
            ...c.args,
            ...c.options,
          }),
        };
      },
    })
    .command("create", {
      description:
        "Create a characteristic-event automation. Requires --allow-mutation.",
      args: z.object({
        name: z.string().describe("Automation name."),
        accessoryId: z
          .string()
          .describe("Trigger accessory UUID or exact name."),
      }),
      options: homeOption.merge(mutationOptions).extend({
        sceneId: z
          .string()
          .optional()
          .describe("Existing scene UUID or exact name to run."),
        actions: z
          .array(automationAction)
          .optional()
          .describe("Inline actions used when sceneId is omitted."),
        press: z
          .enum(["single", "double", "long"])
          .optional()
          .describe("Button press trigger type."),
        characteristic: z
          .string()
          .optional()
          .describe("Characteristic alias or type to observe."),
        triggerValue: z
          .string()
          .optional()
          .describe("Required value for characteristic trigger mode."),
        serviceIndex: z
          .number()
          .int()
          .optional()
          .describe("Button service index."),
        days: z
          .array(z.number().int().min(1).max(7))
          .optional()
          .describe("Weekdays, 1=Sunday...7=Saturday."),
        conditions: z.array(automationCondition).optional(),
        timeAfter: z.array(z.string()).optional(),
        timeBefore: z.array(z.string()).optional(),
        duration: z.number().int().min(1).max(86400).optional(),
      }),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("automations.create", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("create-time", {
      description: "Create a time-based automation. Requires --allow-mutation.",
      args: z.object({
        name: z.string().describe("Automation name."),
        time: z
          .string()
          .describe("HH:MM, sunrise, sunset, or sun event with offset."),
      }),
      options: homeOption.merge(mutationOptions).extend({
        sceneId: z.string().optional().describe("Existing scene to run."),
        actions: z.array(automationAction).optional(),
        days: z.array(z.number().int().min(1).max(7)).optional(),
        conditions: z.array(automationCondition).optional(),
        timeAfter: z.array(z.string()).optional(),
        timeBefore: z.array(z.string()).optional(),
        duration: z.number().int().min(1).max(86400).optional(),
      }),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>(
          "automations.createTime",
          {
            ...c.args,
            ...c.options,
          },
        );
      },
    })
    .command("delete", {
      description: "Delete an automation. Requires --allow-mutation.",
      args: automationIdArg,
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("automations.delete", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("enable", {
      description: "Enable an automation. Requires --allow-mutation.",
      args: automationIdArg,
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("automations.enable", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("disable", {
      description: "Disable an automation. Requires --allow-mutation.",
      args: automationIdArg,
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("automations.disable", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("rewire", {
      description:
        "Attach or detach scenes from an existing automation. Requires --allow-mutation.",
      args: automationIdArg,
      options: homeOption.merge(mutationOptions).extend({
        addSceneIds: z.array(z.string()).default([]),
        removeSceneIds: z.array(z.string()).default([]),
      }),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("automations.rewire", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("add-condition", {
      description:
        "Add a characteristic condition predicate to an automation. Requires --allow-mutation.",
      args: automationIdArg.extend({
        accessoryId: z
          .string()
          .describe("Condition accessory UUID or exact name."),
        characteristic: z.string().describe("Characteristic alias or type."),
        value: z.string().describe("Required value encoded as a string."),
      }),
      options: homeOption.merge(mutationOptions).extend({
        serviceType: z.string().optional(),
      }),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>(
          "automations.addCondition",
          {
            ...c.args,
            ...c.options,
          },
        );
      },
    });
}
