import { BridgeError } from "./bridge-client.js";

export function requireMutationAllowed(allowed: boolean): void {
  if (!allowed) {
    throw new BridgeError(
      "This command mutates HomeKit state. Re-run with --allow-mutation.",
      "MUTATION_REQUIRES_CONFIRMATION",
    );
  }
}
