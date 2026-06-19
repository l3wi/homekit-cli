import { BridgeError } from "./bridge-client.js";

export function requireActuationAllowed(allowActuation: boolean): void {
  if (!allowActuation) {
    throw new BridgeError(
      "Refusing to control HomeKit without --allow-actuation.",
      "ACTUATION_REQUIRES_CONFIRMATION",
    );
  }
}
