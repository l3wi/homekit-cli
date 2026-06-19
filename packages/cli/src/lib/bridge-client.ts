import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";

import {
  bridgeBundleIdentifier,
  bridgeAppName,
  decodeResponse,
  encodeRequest,
  protocolMajorMatches,
  protocolVersion,
  type Capabilities,
  type ControlParams,
  type RpcMethod,
  type RpcRequest,
  type RpcResponse,
} from "../protocol.js";

import { resolveSocketPath } from "./socket-path.js";

export class BridgeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}

export interface BridgeClientOptions {
  socketPath?: string;
  clientName?: string;
  clientVersion?: string;
  autoLaunch?: boolean;
  launchTimeoutMs?: number;
}

export class BridgeClient {
  readonly socketPath: string;
  readonly clientName: string;
  readonly clientVersion: string;
  readonly autoLaunch: boolean;
  readonly launchTimeoutMs: number;

  constructor(options: BridgeClientOptions = {}) {
    this.socketPath = options.socketPath ?? resolveSocketPath();
    this.clientName = options.clientName ?? "homekit-cli";
    this.clientVersion = options.clientVersion ?? "0.1.0";
    this.autoLaunch = options.autoLaunch ?? true;
    this.launchTimeoutMs = options.launchTimeoutMs ?? 7_500;
  }

  async capabilities(): Promise<Capabilities> {
    const response = await this.call<Capabilities>("hello", {
      clientName: this.clientName,
      clientVersion: this.clientVersion,
      protocolVersion,
    });
    if (!protocolMajorMatches(protocolVersion, response.protocolVersion)) {
      throw new BridgeError(
        `Bridge protocol ${response.protocolVersion} is incompatible with client protocol ${protocolVersion}`,
        "PROTOCOL_VERSION_MISMATCH",
        response,
      );
    }
    return response;
  }

  async call<TData = unknown>(
    method: RpcMethod,
    params: Record<string, unknown> = {},
  ): Promise<TData> {
    if (!existsSync(this.socketPath) && this.autoLaunch) {
      await this.launchBridge();
    }

    const request: RpcRequest = {
      id: randomUUID(),
      method,
      params,
    };
    const response = await sendSocketRequest<TData>(this.socketPath, request);
    if (!response.ok) {
      throw new BridgeError(
        response.error.message,
        response.error.code,
        response.error.details,
      );
    }
    return response.data;
  }

  async control(params: ControlParams) {
    return this.call("accessories.control", { ...params } satisfies Record<
      string,
      unknown
    >);
  }

  async launchBridge(): Promise<void> {
    spawn("/usr/bin/open", ["-gj", "-b", bridgeBundleIdentifier], {
      stdio: "ignore",
      detached: true,
    }).unref();

    const deadline = Date.now() + this.launchTimeoutMs;
    while (Date.now() < deadline) {
      if (existsSync(this.socketPath)) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new BridgeError(
      `${bridgeAppName} is not reachable. Open the app once, grant HomeKit access, then retry.`,
      "BRIDGE_UNAVAILABLE",
      { socketPath: this.socketPath, bundleIdentifier: bridgeBundleIdentifier },
    );
  }
}

export function sendSocketRequest<TData>(
  socketPath: string,
  request: RpcRequest,
): Promise<RpcResponse<TData>> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = "";

    socket.setEncoding("utf8");
    socket.setTimeout(10_000);

    socket.once("connect", () => {
      socket.write(encodeRequest(request));
    });

    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      socket.end();
      try {
        resolve(decodeResponse<TData>(buffer.trim()));
      } catch (error) {
        reject(error);
      }
    });

    socket.once("timeout", () => {
      socket.destroy(
        new BridgeError(
          "Timed out waiting for bridge response",
          "BRIDGE_TIMEOUT",
        ),
      );
    });

    socket.once("error", (error) => {
      reject(new BridgeError(error.message, "SOCKET_ERROR", { socketPath }));
    });

    socket.once("end", () => {
      if (!buffer)
        reject(
          new BridgeError(
            "Bridge closed the socket without a response",
            "EMPTY_RESPONSE",
          ),
        );
    });
  });
}

export function bridgeInstallHint() {
  return {
    app: bridgeAppName,
    bundleIdentifier: bridgeBundleIdentifier,
    setup: "Run `homekit bridge setup` after installing the signed bridge app.",
  };
}
