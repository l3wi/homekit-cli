import { Cli, z } from "incur";

import { BridgeClient } from "../lib/bridge-client.js";
import { requireMutationAllowed } from "../lib/mutation.js";

export function webhooksCommand() {
  return Cli.create("webhooks", {
    description:
      "Inspect and configure HomeClaw webhooks for forwarding HomeKit events.",
  })
    .command("status", {
      description: "Show webhook configuration and circuit-breaker state.",
      output: z.object({ webhook: z.unknown() }),
      async run() {
        return {
          webhook: await new BridgeClient().call("webhooks.status"),
        };
      },
    })
    .command("setup", {
      description:
        "Configure the webhook URL/token and enable forwarding. Requires --allow-mutation.",
      args: z.object({
        url: z
          .string()
          .describe("Base webhook URL. /hooks suffixes are stripped."),
      }),
      options: z.object({
        token: z.string().optional().describe("Bearer token."),
        enabled: z
          .boolean()
          .default(true)
          .describe("Enable webhook forwarding."),
        allowMutation: z
          .boolean()
          .default(false)
          .describe("Required. Confirms webhook configuration may change."),
      }),
      output: z.object({ webhook: z.unknown() }),
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return {
          webhook: await new BridgeClient().call("webhooks.setup", {
            ...c.args,
            ...c.options,
          }),
        };
      },
    })
    .command("test", {
      description: "Send HomeClaw's test webhook event.",
      output: z.object({ result: z.unknown() }),
      async run() {
        return { result: await new BridgeClient().call("webhooks.test") };
      },
    })
    .command("reset", {
      description:
        "Reset HomeClaw's webhook circuit breaker. Requires --allow-mutation.",
      options: z.object({
        allowMutation: z
          .boolean()
          .default(false)
          .describe("Required. Confirms webhook state may change."),
      }),
      output: z.object({ result: z.unknown() }),
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return { result: await new BridgeClient().call("webhooks.reset") };
      },
    })
    .command("log", {
      description: "List recent webhook delivery events.",
      options: z.object({
        limit: z.coerce.number().int().min(1).max(500).default(50),
        outcome: z
          .enum(["delivered", "failed", "dropped", "skipped"])
          .optional(),
        since: z
          .string()
          .optional()
          .describe("ISO timestamp or duration such as 1h, 30m, 2d."),
      }),
      output: z.object({ log: z.unknown() }),
      async run(c) {
        return {
          log: await new BridgeClient().call("webhooks.log", c.options),
        };
      },
    })
    .command("log-stats", {
      description: "Show webhook log file size and rotation stats.",
      output: z.object({ stats: z.unknown() }),
      async run() {
        return { stats: await new BridgeClient().call("webhooks.logStats") };
      },
    })
    .command("purge-log", {
      description: "Purge HomeClaw webhook logs. Requires --allow-mutation.",
      options: z.object({
        allowMutation: z
          .boolean()
          .default(false)
          .describe("Required. Confirms webhook logs may be deleted."),
      }),
      output: z.object({ result: z.unknown() }),
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return { result: await new BridgeClient().call("webhooks.purgeLog") };
      },
    });
}
