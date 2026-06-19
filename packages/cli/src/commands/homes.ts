import { Cli, z } from "incur";
import type { HomeSummary } from "../protocol.js";

import { BridgeClient } from "../lib/bridge-client.js";
import { homeSummary } from "./schemas.js";

export function homesCommand() {
  return Cli.create("homes", {
    description:
      "List HomeKit homes visible to the signed bridge app; read-only starting point for scoping every request.",
  }).command("list", {
    description: "List homes visible to the signed bridge app.",
    output: z.object({ homes: z.array(homeSummary) }),
    async run() {
      return {
        homes: await new BridgeClient().call<HomeSummary[]>("homes.list"),
      };
    },
  });
}
