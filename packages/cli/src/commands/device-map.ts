import { Cli, z } from "incur";

import { BridgeClient } from "../lib/bridge-client.js";
import { homeOption } from "./schemas.js";

export function deviceMapCommand() {
  return Cli.create("device-map", {
    description:
      "Return a read-only, LLM-friendly map of homes, rooms, accessories, services, and controllable characteristics for planning before writes.",
    options: homeOption,
    output: z.object({ deviceMap: z.unknown() }),
    async run(c) {
      return {
        deviceMap: await new BridgeClient().call("deviceMap.get", c.options),
      };
    },
  });
}
