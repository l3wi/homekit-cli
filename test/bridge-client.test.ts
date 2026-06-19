import { afterEach, describe, expect, it } from "vitest";
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { HomeClawRequest } from "../src/protocol.js";
import { BridgeClient, BridgeError } from "../src/lib/bridge-client.js";
import { requireActuationAllowed } from "../src/lib/actuation.js";

const tempDirs: string[] = [];
const servers: net.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise((resolve) => server.close(resolve))),
  );
  for (const dir of tempDirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

async function createFakeBridge(
  handler: (request: HomeClawRequest) => unknown,
) {
  const dir = mkdtempSync(join(tmpdir(), "homekit-cli-test-"));
  tempDirs.push(dir);
  const socketPath = join(dir, "bridge.sock");
  const server = net.createServer((socket) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      const request = JSON.parse(buffer.trim()) as HomeClawRequest;
      const data = handler(request);
      socket.end(`${JSON.stringify({ success: true, data })}\n`);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  return socketPath;
}

describe("BridgeClient", () => {
  it("synthesizes capabilities from HomeClaw status", async () => {
    const socketPath = await createFakeBridge((request) => {
      expect(request.command).toBe("status");
      return {
        ready: true,
        homes: 1,
        accessories: 2,
      };
    });

    const capabilities = await new BridgeClient({
      socketPath,
      clientName: "test-client",
      autoLaunch: false,
    }).capabilities();

    expect(capabilities.features).toContain("status");
    expect(capabilities.homeKitReady).toBe(true);
  });

  it("rejects HomeClaw error responses", async () => {
    const dir = mkdtempSync(join(tmpdir(), "homekit-cli-test-"));
    tempDirs.push(dir);
    const socketPath = join(dir, "bridge.sock");
    const server = net.createServer((socket) => {
      socket.setEncoding("utf8");
      socket.on("data", () => {
        socket.end(`${JSON.stringify({ success: false, error: "Nope" })}\n`);
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));

    await expect(
      new BridgeClient({ socketPath, autoLaunch: false }).call("status"),
    ).rejects.toMatchObject({
      code: "HOMECLAW_ERROR",
    });
  });

  it("sends HomeClaw commands over the socket", async () => {
    const socketPath = await createFakeBridge((request) => {
      expect(request.command).toBe("status");
      expect(request.args).toEqual({});
      return { ready: true, homes: 0, accessories: 0 };
    });

    await expect(
      new BridgeClient({ socketPath, autoLaunch: false }).call("status"),
    ).resolves.toMatchObject({ ready: true });
  });

  it("explains the HomeClaw app prerequisite when the socket is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "homekit-cli-test-"));
    tempDirs.push(dir);
    const socketPath = join(dir, "missing.sock");

    await expect(
      new BridgeClient({ socketPath, autoLaunch: false }).call("status"),
    ).rejects.toMatchObject({
      code: "SOCKET_NOT_FOUND",
      message: expect.stringContaining("Install HomeClaw"),
      details: expect.objectContaining({
        appStoreUrl:
          "https://apps.apple.com/us/app/homeclaw/id6759682551?mt=12",
        skipBundledCliAndMcp: true,
      }),
    });
  });
});

describe("actuation guard", () => {
  it("requires explicit actuation opt-in", () => {
    expect(() => requireActuationAllowed(false)).toThrow(BridgeError);
    expect(() => requireActuationAllowed(true)).not.toThrow();
  });
});
