import { Cli, z } from "incur";

import type { WebhookTriggerSummary } from "../protocol.js";
import { BridgeClient } from "../lib/bridge-client.js";
import { requireMutationAllowed } from "../lib/mutation.js";

const triggerOutput = z.object({
  id: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  events: z.array(z.string()).optional(),
  accessories: z.array(z.string()).optional(),
  scenes: z.array(z.string()).optional(),
  characteristics: z.array(z.string()).optional(),
});

const triggerOptions = z.object({
  enabled: z.boolean().optional().describe("Enable or disable the trigger."),
  events: z
    .array(z.string())
    .optional()
    .describe("Webhook event types to include."),
  accessory: z
    .string()
    .optional()
    .describe("Accessory UUID/name to include in the trigger."),
  scene: z.string().optional().describe("Scene UUID/name to include."),
  characteristic: z
    .string()
    .optional()
    .describe("Characteristic name to include."),
  allowMutation: z
    .boolean()
    .default(false)
    .describe("Required. Confirms webhook trigger configuration may change."),
});

export function triggersCommand() {
  return Cli.create("triggers", {
    description:
      "Inspect and manage HomeClaw webhook triggers that select which HomeKit events are forwarded.",
  })
    .command("list", {
      description: "List HomeClaw webhook triggers.",
      output: z.object({ triggers: z.array(triggerOutput) }),
      async run() {
        const result = await new BridgeClient().call<{
          triggers?: WebhookTriggerSummary[];
        }>("triggers.list");
        return { triggers: result.triggers ?? [] };
      },
    })
    .command("add", {
      description: "Create a webhook trigger. Requires --allow-mutation.",
      args: z.object({
        label: z.string().describe("Human label for the trigger."),
      }),
      options: triggerOptions,
      output: z.object({ trigger: triggerOutput }),
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        const trigger = await new BridgeClient().call<WebhookTriggerSummary>(
          "triggers.add",
          {
            ...c.args,
            ...c.options,
          },
        );
        return { trigger };
      },
    })
    .command("update", {
      description: "Update a webhook trigger. Requires --allow-mutation.",
      args: z.object({
        triggerId: z.string().describe("Trigger UUID."),
        label: z.string().optional().describe("New trigger label."),
      }),
      options: triggerOptions,
      output: z.object({ trigger: triggerOutput }),
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        const trigger = await new BridgeClient().call<WebhookTriggerSummary>(
          "triggers.update",
          {
            ...c.args,
            ...c.options,
          },
        );
        return { trigger };
      },
    })
    .command("remove", {
      description: "Remove a webhook trigger. Requires --allow-mutation.",
      args: z.object({
        triggerId: z.string().describe("Trigger UUID."),
      }),
      options: z.object({
        allowMutation: z
          .boolean()
          .default(false)
          .describe("Required. Confirms a webhook trigger may be removed."),
      }),
      output: z.object({ result: z.unknown() }),
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return {
          result: await new BridgeClient().call("triggers.remove", c.args),
        };
      },
    });
}
