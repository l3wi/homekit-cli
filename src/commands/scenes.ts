import { Cli, z } from "incur";
import type { MutationResult, SceneSummary } from "../protocol.js";

import { BridgeClient } from "../lib/bridge-client.js";
import { requireActuationAllowed } from "../lib/actuation.js";
import { requireMutationAllowed } from "../lib/mutation.js";
import {
  homeOption,
  mutationOptions,
  mutationResult,
  sceneSummary,
} from "./schemas.js";

const sceneAction = z.object({
  accessoryId: z.string().describe("Accessory UUID or exact name."),
  characteristic: z.string().describe("Characteristic alias or type."),
  value: z.string().describe("Target value encoded as a string."),
  serviceType: z.string().optional().describe("Optional service type filter."),
});

export function scenesCommand() {
  return Cli.create("scenes", {
    description:
      "Inspect and manage HomeKit scenes/action sets; scene writes require --allow-mutation and exact accessory actions.",
  })
    .command("list", {
      description: "List scenes/action sets. This is read-only.",
      options: homeOption,
      output: z.object({ scenes: z.array(sceneSummary) }),
      async run(c) {
        return {
          scenes: await new BridgeClient().call<SceneSummary[]>(
            "scenes.list",
            c.options,
          ),
        };
      },
    })
    .command("get", {
      description: "Inspect one scene/action set. This is read-only.",
      args: z.object({
        sceneId: z.string().describe("Scene UUID or exact name."),
      }),
      output: z.object({ scene: z.unknown() }),
      async run(c) {
        return {
          scene: await new BridgeClient().call("scenes.get", {
            sceneId: c.args.sceneId,
          }),
        };
      },
    })
    .command("import", {
      description:
        "Create a scene from explicit actions. Requires --allow-mutation.",
      args: z.object({
        name: z.string().describe("Scene name."),
      }),
      options: homeOption.merge(mutationOptions).extend({
        actions: z
          .array(sceneAction)
          .describe(
            "Scene actions. MCP callers should pass structured actions.",
          ),
      }),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("scenes.import", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("trigger", {
      description:
        "Run a HomeKit scene. Requires --allow-actuation because scene actions may change physical devices.",
      args: z.object({
        sceneId: z.string().describe("Scene UUID or exact name."),
      }),
      options: homeOption.extend({
        allowActuation: z
          .boolean()
          .default(false)
          .describe("Required. Confirms physical devices may change."),
      }),
      output: mutationResult,
      async run(c) {
        requireActuationAllowed(c.options.allowActuation);
        return new BridgeClient().call<MutationResult>("scenes.trigger", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("update", {
      description:
        "Replace actions on an existing scene while preserving its UUID. Requires --allow-mutation.",
      args: z.object({
        sceneId: z.string().describe("Scene UUID or exact name."),
      }),
      options: homeOption.merge(mutationOptions).extend({
        actions: z.array(sceneAction).describe("Replacement scene actions."),
      }),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("scenes.update", {
          ...c.args,
          ...c.options,
        });
      },
    })
    .command("delete", {
      description: "Delete a scene. Requires --allow-mutation.",
      args: z.object({
        sceneId: z.string().describe("Scene UUID or exact name."),
      }),
      options: homeOption.merge(mutationOptions),
      output: mutationResult,
      async run(c) {
        requireMutationAllowed(c.options.allowMutation);
        return new BridgeClient().call<MutationResult>("scenes.delete", {
          ...c.args,
          ...c.options,
        });
      },
    });
}
