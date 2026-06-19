import { Cli, z } from "incur";
import type { EventSummary } from "../protocol.js";

import { BridgeClient } from "../lib/bridge-client.js";
import { eventSummary } from "./schemas.js";

export function eventsCommand() {
  return Cli.create("events", {
    description:
      "Inspect the bridge's recent in-memory HomeKit event buffer for troubleshooting state changes and live updates.",
  }).command("list", {
    description:
      "List recent HomeKit events observed by the bridge. This is read-only.",
    options: z.object({
      limit: z.coerce.number().int().min(1).max(500).default(50),
      since: z.string().optional().describe("ISO timestamp lower bound."),
      type: z.string().optional().describe("Optional event type filter."),
    }),
    output: z.object({ events: z.array(eventSummary) }),
    async run(c) {
      return {
        events: await new BridgeClient().call<EventSummary[]>(
          "events.list",
          c.options,
        ),
      };
    },
  });
}
