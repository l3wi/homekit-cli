import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";

import {
  bridgeAppName,
  bridgeAppStoreUrl,
  bridgeBundleIdentifier,
  bridgeSourceUrl,
  decodeResponse,
  encodeRequest,
  protocolVersion,
  type Capabilities,
  type ControlParams,
  type HomeClawRequest,
  type HomeClawResponse,
  type RpcMethod,
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

interface HomeContext {
  id: string;
  name: string;
}

const features = [
  "status",
  "homes",
  "rooms",
  "accessories",
  "scenes",
  "automations",
  "zones",
  "events",
  "device-map",
  "control",
  "webhooks",
  "triggers",
] as const;

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
    const status = await this.call<Record<string, unknown>>("status");
    return {
      bridgeVersion: String(status.version ?? "homeclaw"),
      protocolVersion,
      features: [...features],
      socketPath: this.socketPath,
      homeKitReady: Boolean(status.ready),
    };
  }

  async call<TData = unknown>(
    method: RpcMethod,
    params: Record<string, unknown> = {},
  ): Promise<TData> {
    if (!existsSync(this.socketPath) && this.autoLaunch) {
      await this.launchBridge();
    }

    const data = await this.dispatch(method, params);
    return data as TData;
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
      homeClawRequiredMessage(this.socketPath),
      "BRIDGE_UNAVAILABLE",
      homeClawInstallDetails(this.socketPath),
    );
  }

  private async dispatch(method: RpcMethod, params: Record<string, unknown>) {
    switch (method) {
      case "hello":
        return this.capabilities();
      case "status":
        return normalizeStatus(
          await this.sendCommand<Record<string, unknown>>("status"),
          this.socketPath,
        );
      case "homes.list":
        return this.listHomes();
      case "rooms.list":
        return this.withHomeContext(async (home) =>
          normalizeRooms(
            await this.sendCommand("list_rooms", homeArg(params)),
            home,
          ),
        );
      case "rooms.create":
        return normalizeMutation(
          await this.sendCommand("create_room", {
            name: params.name,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "rooms.rename":
        return normalizeMutation(
          await this.sendCommand("rename_room", {
            id: params.roomId,
            new_name: params.newName,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "rooms.remove":
        return normalizeMutation(
          await this.sendCommand("remove_room", {
            id: params.roomId,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "rooms.assign":
        return normalizeMutation(
          await this.sendCommand("assign_rooms", {
            assignments: [
              { uuid: params.accessoryId, room: String(params.roomId ?? "") },
            ],
            home: params.homeId,
            ...dryRunArg(params),
          }),
          params,
        );
      case "accessories.list":
        return this.withHomeContext(async (home) =>
          normalizeAccessories(
            await this.sendCommand("list_accessories", {
              ...homeArg(params),
              room: params.room,
              category: params.category,
            }),
            home,
          ),
        );
      case "accessories.get":
        return this.withHomeContext(async (home) =>
          normalizeAccessory(
            await this.sendCommand("get_accessory", {
              id: params.accessoryId,
              ...homeArg(params),
              refresh: params.noRefresh === true ? false : undefined,
            }),
            home,
          ),
        );
      case "accessories.search":
        return this.withHomeContext(async (home) =>
          normalizeAccessories(
            await this.sendCommand("search", {
              query: params.query,
              category: params.category,
              ...homeArg(params),
            }),
            home,
          ),
        );
      case "accessories.control":
        return normalizeMutation(
          await this.sendCommand("control", {
            id: params.accessoryId,
            characteristic: params.characteristic,
            value: params.value,
            service_type: params.serviceType,
            ...homeArg(params),
          }),
          params,
          { dryRun: false },
        );
      case "accessories.remove":
        return normalizeMutation(
          await this.sendCommand("remove_accessory", {
            id: params.accessoryId,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "scenes.list":
        return this.withHomeContext(async (home) =>
          normalizeScenes(
            await this.sendCommand("list_scenes", homeArg(params)),
            home,
          ),
        );
      case "scenes.get":
        return this.sendCommand("get_scene", {
          id: params.sceneId,
          ...homeArg(params),
        });
      case "scenes.trigger":
        return normalizeMutation(
          await this.sendCommand("trigger_scene", {
            id: params.sceneId,
            ...homeArg(params),
          }),
          params,
          { dryRun: false },
        );
      case "scenes.import":
        return normalizeMutation(
          await this.sendCommand("import_scene", {
            name: params.name,
            actions: params.actions,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "scenes.update":
        return normalizeMutation(
          await this.sendCommand("update_scene", {
            id: params.sceneId,
            name: params.sceneId,
            actions: params.actions,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "scenes.delete":
        return normalizeMutation(
          await this.sendCommand("delete_scene", {
            name: params.sceneId,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "automations.list":
        return this.withHomeContext(async (home) =>
          normalizeAutomations(
            await this.sendCommand("list_automations", homeArg(params)),
            home,
          ),
        );
      case "automations.get":
        return this.sendCommand("get_automation", {
          id: params.automationId,
          ...homeArg(params),
        });
      case "automations.create":
        return normalizeMutation(
          await this.sendCommand("create_automation", {
            name: params.name,
            accessory_id: params.accessoryId,
            scene_id: params.sceneId,
            actions: params.actions,
            press_type: pressType(params.press),
            characteristic: params.characteristic,
            trigger_value: params.triggerValue,
            service_index: params.serviceIndex,
            weekdays: params.days,
            conditions: params.conditions,
            time_after: params.timeAfter,
            time_before: params.timeBefore,
            duration_seconds: params.duration,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "automations.createTime":
        return normalizeMutation(
          await this.sendCommand("create_time_automation", {
            name: params.name,
            time: params.time,
            scene_id: params.sceneId,
            actions: params.actions,
            weekdays: params.days,
            conditions: params.conditions,
            time_after: params.timeAfter,
            time_before: params.timeBefore,
            duration_seconds: params.duration,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "automations.delete":
        return normalizeMutation(
          await this.sendCommand("delete_automation", {
            id: params.automationId,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "automations.enable":
      case "automations.disable":
        return normalizeMutation(
          await this.sendCommand("enable_automation", {
            id: params.automationId,
            enabled: String(method === "automations.enable"),
            ...homeArg(params),
          }),
          params,
        );
      case "automations.rewire":
        return normalizeMutation(
          await this.sendCommand("update_automation", {
            id: params.automationId,
            add_scenes: params.addSceneIds,
            remove_scenes: params.removeSceneIds,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "automations.addCondition":
        return normalizeMutation(
          await this.sendCommand("add_automation_condition", {
            id: params.automationId,
            accessory: params.accessoryId,
            property: params.characteristic,
            value: params.value,
            room: params.room,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "zones.list":
        return this.withHomeContext(async (home) =>
          normalizeZonesFromDeviceMap(
            await this.sendCommand("device_map", homeArg(params)),
            home,
          ),
        );
      case "zones.create":
        return normalizeMutation(
          await this.sendCommand("create_zone", {
            name: params.name,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "zones.remove":
        return normalizeMutation(
          await this.sendCommand("remove_zone", {
            id: params.zoneId,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "zones.addRoom":
      case "zones.removeRoom":
        return normalizeMutation(
          await this.sendCommand(
            method === "zones.addRoom"
              ? "add_room_to_zone"
              : "remove_room_from_zone",
            {
              zone: params.zoneId,
              room: params.roomId,
              ...homeArg(params),
              ...dryRunArg(params),
            },
          ),
          params,
        );
      case "rename":
        return normalizeMutation(
          await this.sendCommand("rename", {
            id: params.id,
            new_name: params.newName,
            ...homeArg(params),
            ...dryRunArg(params),
          }),
          params,
        );
      case "deviceMap.get":
        return this.sendCommand("device_map", homeArg(params));
      case "events.list":
        return normalizeEvents(
          await this.sendCommand("events", {
            limit: params.limit,
            since: params.since,
            type: params.type,
          }),
        );
      case "webhooks.status": {
        const status =
          await this.sendCommand<Record<string, unknown>>("status");
        return status.webhook ?? { enabled: false };
      }
      case "webhooks.setup":
        return this.sendCommand("set_webhook", {
          url: normalizeWebhookUrl(params.url),
          token: params.token,
          enabled: String(params.enabled !== false),
        });
      case "webhooks.test":
        return this.sendCommand("webhook_test");
      case "webhooks.reset":
        return this.sendCommand("webhook_reset");
      case "webhooks.log":
        return this.sendCommand("webhook_log", {
          limit: params.limit,
          outcome: params.outcome,
          since: params.since,
        });
      case "webhooks.logStats":
        return this.sendCommand("webhook_log_stats");
      case "webhooks.purgeLog":
        return this.sendCommand("purge_webhook_log");
      case "triggers.list":
        return this.sendCommand("list_triggers");
      case "triggers.add":
        return this.sendCommand("add_trigger", triggerArgs(params));
      case "triggers.update":
        return this.sendCommand("update_trigger", {
          id: params.triggerId,
          ...triggerArgs(params),
        });
      case "triggers.remove":
        return this.sendCommand("remove_trigger", { id: params.triggerId });
      case "bridge.stop":
        return {
          stopped: false,
          note: "HomeClaw does not expose a stop command.",
        };
      default:
        throw new BridgeError(
          `Unsupported method: ${method}`,
          "UNSUPPORTED_METHOD",
        );
    }
  }

  private async listHomes() {
    const config =
      await this.sendCommand<Record<string, unknown>>("get_config");
    const homes = Array.isArray(config.available_homes)
      ? config.available_homes
      : [];
    return homes.map((home) => {
      const record = asRecord(home);
      return {
        id: String(record.id ?? ""),
        name: String(record.name ?? ""),
        primary: Boolean(record.is_primary),
      };
    });
  }

  private async selectedHome(): Promise<HomeContext> {
    const config =
      await this.sendCommand<Record<string, unknown>>("get_config");
    const homes = Array.isArray(config.available_homes)
      ? config.available_homes.map(asRecord)
      : [];
    const selected =
      homes.find((home) => home.is_selected === true) ??
      homes.find((home) => home.is_primary === true) ??
      homes[0];
    return {
      id: String(selected?.id ?? ""),
      name: String(selected?.name ?? ""),
    };
  }

  private async withHomeContext<T>(fn: (home: HomeContext) => Promise<T>) {
    return fn(await this.selectedHome());
  }

  private async sendCommand<TData = unknown>(
    command: string,
    args: Record<string, unknown> = {},
  ): Promise<TData> {
    const cleanedArgs = cleanArgs(args);
    const response = await sendSocketRequest<TData>(this.socketPath, {
      command,
      args: cleanedArgs,
    });
    if (!response.success) {
      throw new BridgeError(response.error, "HOMECLAW_ERROR", {
        command,
        args: cleanedArgs,
      });
    }
    return response.data;
  }
}

export function sendSocketRequest<TData>(
  socketPath: string,
  request: HomeClawRequest,
): Promise<HomeClawResponse<TData>> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = "";

    socket.setEncoding("utf8");
    socket.setTimeout(30_000);

    socket.once("connect", () => {
      socket.write(encodeRequest(request));
    });

    socket.on("data", (chunk) => {
      buffer += chunk;
    });

    socket.once("end", () => {
      if (!buffer) {
        reject(
          new BridgeError(
            "HomeClaw closed the socket without a response",
            "EMPTY_RESPONSE",
          ),
        );
        return;
      }
      try {
        resolve(decodeResponse<TData>(buffer.trim()));
      } catch (error) {
        reject(error);
      }
    });

    socket.once("timeout", () => {
      socket.destroy(
        new BridgeError(
          "Timed out waiting for HomeClaw response",
          "BRIDGE_TIMEOUT",
        ),
      );
    });

    socket.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(
          new BridgeError(
            homeClawRequiredMessage(socketPath),
            "SOCKET_NOT_FOUND",
            homeClawInstallDetails(socketPath),
          ),
        );
        return;
      }
      reject(new BridgeError(error.message, "SOCKET_ERROR", { socketPath }));
    });
  });
}

export function bridgeInstallHint() {
  return {
    app: bridgeAppName,
    bundleIdentifier: bridgeBundleIdentifier,
    appStoreUrl: bridgeAppStoreUrl,
    sourceUrl: bridgeSourceUrl,
    socketPath: resolveSocketPath(),
    setup:
      "Install HomeClaw from the Mac App Store or TestFlight, launch it once, grant HomeKit access, then run `homekit bridge setup`. Skip HomeClaw's bundled CLI and MCP setup; use this package's `homekit` CLI, MCP server, docs, and skills.",
  };
}

function homeClawRequiredMessage(socketPath: string) {
  return [
    "HomeClaw is required for HomeKit access.",
    "Install HomeClaw from the Mac App Store or TestFlight, launch it once, approve HomeKit permission, then retry.",
    `App Store: ${bridgeAppStoreUrl}`,
    `Expected socket: ${socketPath}`,
    "HomeClaw bundles its own CLI and MCP server, but this package intentionally does not use them. Skip HomeClaw's CLI/MCP setup and use `homekit-cli` for agent docs, schemas, skills, and MCP.",
  ].join(" ");
}

function homeClawInstallDetails(socketPath: string) {
  return {
    app: bridgeAppName,
    bundleIdentifier: bridgeBundleIdentifier,
    appStoreUrl: bridgeAppStoreUrl,
    sourceUrl: bridgeSourceUrl,
    socketPath,
    skipBundledCliAndMcp: true,
  };
}

function homeArg(params: Record<string, unknown>) {
  return params.homeId ? { home_id: params.homeId } : {};
}

function dryRunArg(params: Record<string, unknown>) {
  return params.dryRun === true ? { dry_run: true } : {};
}

function pressType(value: unknown) {
  if (value === "double") return 1;
  if (value === "long") return 2;
  if (typeof value === "number") return value;
  return 0;
}

function cleanArgs(args: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(args).filter(([, value]) => value !== undefined),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeStatus(raw: Record<string, unknown>, socketPath: string) {
  const cache = asRecord(raw.cache);
  return {
    ...raw,
    ready: Boolean(raw.ready),
    bridgeVersion: String(raw.version ?? "homeclaw"),
    protocolVersion,
    homes: Number(raw.homes ?? 0),
    accessories: Number(raw.accessories ?? 0),
    socketPath,
    cache: {
      ...cache,
      warmed: cache.is_stale !== true,
      accessoryCount: Number(cache.cached_accessories ?? raw.accessories ?? 0),
      updatedAt: cache.last_warmed ? String(cache.last_warmed) : undefined,
    },
  };
}

function normalizeAccessory(item: unknown, home: HomeContext) {
  const record = asRecord(item);
  return {
    ...record,
    homeId: String(record.home_id ?? record.homeId ?? home.id),
    homeName: String(record.home_name ?? record.homeName ?? home.name),
    roomId: optionalString(record.room_id ?? record.roomId),
    roomName: optionalString(record.room ?? record.roomName),
    serialNumber: optionalString(record.serial_number ?? record.serialNumber),
    firmwareVersion: optionalString(
      record.firmware_version ?? record.firmwareVersion,
    ),
  };
}

function normalizeAccessories(items: unknown, home: HomeContext) {
  return (Array.isArray(items) ? items : []).map((item) =>
    normalizeAccessory(item, home),
  );
}

function normalizeRooms(items: unknown, home: HomeContext) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const record = asRecord(item);
    return {
      ...record,
      id: String(record.id ?? ""),
      name: String(record.name ?? ""),
      homeId: String(record.home_id ?? record.homeId ?? home.id),
      homeName: String(record.home_name ?? record.homeName ?? home.name),
      accessoryCount: Number(
        record.accessory_count ?? record.accessoryCount ?? 0,
      ),
    };
  });
}

function normalizeScenes(items: unknown, home: HomeContext) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const record = asRecord(item);
    return {
      ...record,
      id: String(record.id ?? ""),
      name: String(record.name ?? ""),
      homeId: String(record.home_id ?? record.homeId ?? home.id),
      homeName: String(record.home_name ?? record.homeName ?? home.name),
      actionCount: Number(record.action_count ?? record.actionCount ?? 0),
    };
  });
}

function normalizeAutomations(items: unknown, home: HomeContext) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const record = asRecord(item);
    return {
      ...record,
      id: String(record.id ?? ""),
      name: String(record.name ?? ""),
      homeId: String(record.home_id ?? record.homeId ?? home.id),
      homeName: String(
        record.home ?? record.home_name ?? record.homeName ?? home.name,
      ),
      enabled: Boolean(record.enabled),
      eventCount: Number(record.event_count ?? record.eventCount ?? 0),
      actionSetCount: Number(
        record.action_set_count ??
          record.actionSetCount ??
          record.scene_count ??
          0,
      ),
      scenes: Array.isArray(record.scenes) ? record.scenes.map(String) : [],
      eventSummary: optionalString(record.event_summary ?? record.eventSummary),
    };
  });
}

function normalizeZones(items: unknown, home: HomeContext) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const record = asRecord(item);
    const rooms = Array.isArray(record.rooms)
      ? normalizeRooms(record.rooms, home)
      : undefined;
    return {
      ...record,
      id: String(record.id ?? ""),
      name: String(record.name ?? ""),
      homeId: String(record.home_id ?? record.homeId ?? home.id),
      homeName: String(record.home_name ?? record.homeName ?? home.name),
      roomCount: Number(
        record.room_count ?? record.roomCount ?? rooms?.length ?? 0,
      ),
      rooms,
    };
  });
}

function normalizeEvents(raw: unknown) {
  const items = Array.isArray(raw) ? raw : asRecord(raw).events;
  return (Array.isArray(items) ? items : []).map((item) => {
    const record = asRecord(item);
    const home = asRecord(record.home);
    const accessory = asRecord(record.accessory);
    const message =
      record.message ??
      record.description ??
      [
        home.name ?? record.home,
        accessory.name ?? record.accessory,
        record.characteristic,
      ]
        .filter(Boolean)
        .join(" ");
    return {
      ...record,
      id: String(record.id ?? stableId(record)),
      date: String(record.date ?? record.timestamp ?? record.created_at ?? ""),
      type: String(record.type ?? "event"),
      homeName: optionalString(record.home_name ?? home.name ?? record.home),
      accessoryName: optionalString(
        record.accessory_name ?? accessory.name ?? record.accessory,
      ),
      message: String(message || "HomeKit event"),
    };
  });
}

function normalizeZonesFromDeviceMap(raw: unknown, fallbackHome: HomeContext) {
  const rawHomes = asRecord(raw).homes;
  const homes: unknown[] = Array.isArray(rawHomes) ? rawHomes : [];
  return homes.flatMap((homeItem) => {
    const home = asRecord(homeItem);
    const homeContext = {
      id: String(home.id ?? fallbackHome.id),
      name: String(home.name ?? fallbackHome.name),
    };
    const zones = Array.isArray(home.zones) ? home.zones : [];
    return zones.map((zoneItem) => {
      const zone = asRecord(zoneItem);
      const rooms = Array.isArray(zone.rooms)
        ? zone.rooms.map((roomItem) => {
            const room = asRecord(roomItem);
            return {
              id: stableId({
                homeId: homeContext.id,
                zone: zone.name,
                room: room.name,
              }),
              name: String(room.name ?? ""),
              homeId: homeContext.id,
              homeName: homeContext.name,
              accessoryCount: Array.isArray(room.devices)
                ? room.devices.length
                : 0,
            };
          })
        : [];
      return {
        id: stableId({ homeId: homeContext.id, zone: zone.name }),
        name: String(zone.name ?? ""),
        homeId: homeContext.id,
        homeName: homeContext.name,
        roomCount: rooms.length,
        rooms,
      };
    });
  });
}

function normalizeMutation(
  raw: unknown,
  params: Record<string, unknown>,
  overrides: Partial<{ dryRun: boolean }> = {},
) {
  const record = asRecord(raw);
  const id =
    record.id ??
    params.id ??
    params.accessoryId ??
    params.roomId ??
    params.zoneId ??
    params.sceneId ??
    params.automationId;
  return {
    ...record,
    auditId: String(
      record.auditId ?? record.audit_id ?? stableId({ raw, params }),
    ),
    accepted: record.accepted !== false,
    dryRun: overrides.dryRun ?? Boolean(params.dryRun),
    id: id === undefined ? undefined : String(id),
    name: optionalString(record.name ?? params.name),
    oldName: optionalString(record.old_name ?? record.oldName),
    newName: optionalString(
      record.new_name ?? record.newName ?? params.newName,
    ),
    homeId: optionalString(record.home_id ?? record.homeId ?? params.homeId),
    homeName: optionalString(record.home_name ?? record.homeName),
  };
}

function normalizeWebhookUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  let url = value;
  for (const suffix of ["/hooks/wake", "/hooks/agent", "/hooks"]) {
    if (url.endsWith(suffix)) {
      url = url.slice(0, -suffix.length);
      break;
    }
  }
  return url;
}

function triggerArgs(params: Record<string, unknown>) {
  return cleanArgs({
    label: params.label,
    enabled: params.enabled,
    events: params.events,
    accessory: params.accessory,
    scene: params.scene,
    characteristic: params.characteristic,
  });
}

function stableId(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

function optionalString(value: unknown) {
  return value === undefined || value === null ? undefined : String(value);
}
