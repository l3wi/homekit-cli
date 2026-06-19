import { afterEach, describe, expect, it } from "vitest";
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { protocolVersion, type RpcRequest } from "../src/protocol.js";
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

async function createFakeBridge(handler: (request: RpcRequest) => unknown) {
  const dir = mkdtempSync(join(tmpdir(), "homekit-cli-test-"));
  tempDirs.push(dir);
  const socketPath = join(dir, "bridge.sock");
  const server = net.createServer((socket) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      const request = JSON.parse(buffer.trim()) as RpcRequest;
      const data = handler(request);
      socket.end(`${JSON.stringify({ id: request.id, ok: true, data })}\n`);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  return socketPath;
}

describe("BridgeClient", () => {
  it("performs a hello handshake and returns capabilities", async () => {
    const socketPath = await createFakeBridge((request) => {
      expect(request.method).toBe("hello");
      expect(request.params).toMatchObject({
        clientName: "test-client",
        protocolVersion,
      });
      return {
        bridgeVersion: "0.1.0",
        protocolVersion,
        features: ["status"],
        socketPath: "/tmp/test.sock",
        homeKitReady: true,
      };
    });

    const capabilities = await new BridgeClient({
      socketPath,
      clientName: "test-client",
      autoLaunch: false,
    }).capabilities();

    expect(capabilities.features).toContain("status");
  });

  it("rejects incompatible protocol major versions", async () => {
    const socketPath = await createFakeBridge(() => ({
      bridgeVersion: "0.1.0",
      protocolVersion: "2.0.0",
      features: [],
      socketPath: "/tmp/test.sock",
      homeKitReady: true,
    }));

    await expect(
      new BridgeClient({ socketPath, autoLaunch: false }).capabilities(),
    ).rejects.toMatchObject({
      code: "PROTOCOL_VERSION_MISMATCH",
    });
  });

  it("sends normal RPC requests over the socket", async () => {
    const socketPath = await createFakeBridge((request) => {
      expect(request.method).toBe("status");
      return { ready: true };
    });

    await expect(
      new BridgeClient({ socketPath, autoLaunch: false }).call("status"),
    ).resolves.toEqual({
      ready: true,
    });
  });
});

describe("actuation guard", () => {
  it("requires explicit actuation opt-in", () => {
    expect(() => requireActuationAllowed(false)).toThrow(BridgeError);
    expect(() => requireActuationAllowed(true)).not.toThrow();
  });
});
