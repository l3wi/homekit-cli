import { homedir } from "node:os";
import { join } from "node:path";

import { appGroupIdentifier, socketFileName } from "../protocol.js";

export function resolveSocketPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.HOMEKIT_SOCKET_PATH) return env.HOMEKIT_SOCKET_PATH;

  const groupContainerPath = join(
    homedir(),
    "Library",
    "Group Containers",
    appGroupIdentifier,
    socketFileName,
  );
  if (env.HOMEKIT_USE_LEGACY_TMP_SOCKET === "1") return "/tmp/homeclaw.sock";

  return groupContainerPath;
}
