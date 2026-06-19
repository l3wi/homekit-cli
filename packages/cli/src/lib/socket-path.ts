import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { appGroupIdentifier, socketFileName } from "../protocol.js";

export function resolveSocketPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.HOMEKIT_SOCKET_PATH) return env.HOMEKIT_SOCKET_PATH;

  const groupIdentifier =
    env.HOMEKIT_APP_GROUP_IDENTIFIER ?? appGroupIdentifier;
  const groupContainerPath = join(
    homedir(),
    "Library",
    "Group Containers",
    groupIdentifier,
    socketFileName,
  );
  if (env.HOMEKIT_USE_TMP_SOCKET !== "1") return groupContainerPath;

  return join(env.TMPDIR ?? tmpdir(), "ad.blackwattle.homekit.sock");
}
