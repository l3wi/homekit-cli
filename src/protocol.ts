export const protocolVersion = "1.0.0";
export const bridgeBundleIdentifier = "com.shahine.homeclaw";
export const bridgeAppName = "HomeClaw";
export const bridgeAppStoreUrl =
  "https://apps.apple.com/us/app/homeclaw/id6759682551?mt=12";
export const bridgeSourceUrl = "https://github.com/omarshahine/HomeClaw";
export const socketFileName = "homeclaw.sock";
export const appGroupIdentifier = "group.com.shahine.homeclaw";

export type BridgeFeature =
  | "status"
  | "homes"
  | "rooms"
  | "accessories"
  | "scenes"
  | "automations"
  | "zones"
  | "events"
  | "device-map"
  | "control"
  | "webhooks"
  | "triggers";

export type RpcMethod =
  | "hello"
  | "status"
  | "homes.list"
  | "rooms.list"
  | "rooms.create"
  | "rooms.rename"
  | "rooms.remove"
  | "rooms.assign"
  | "accessories.list"
  | "accessories.get"
  | "accessories.search"
  | "accessories.control"
  | "accessories.remove"
  | "scenes.list"
  | "scenes.get"
  | "scenes.trigger"
  | "scenes.import"
  | "scenes.update"
  | "scenes.delete"
  | "automations.list"
  | "automations.get"
  | "automations.create"
  | "automations.createTime"
  | "automations.delete"
  | "automations.enable"
  | "automations.disable"
  | "automations.rewire"
  | "automations.addCondition"
  | "zones.list"
  | "zones.create"
  | "zones.remove"
  | "zones.addRoom"
  | "zones.removeRoom"
  | "rename"
  | "deviceMap.get"
  | "events.list"
  | "webhooks.status"
  | "webhooks.setup"
  | "webhooks.test"
  | "webhooks.reset"
  | "webhooks.log"
  | "webhooks.logStats"
  | "webhooks.purgeLog"
  | "triggers.list"
  | "triggers.add"
  | "triggers.update"
  | "triggers.remove"
  | "bridge.stop";

export interface RpcRequest<TParams = Record<string, unknown>> {
  id: string;
  method: RpcMethod;
  params?: TParams;
}

export interface RpcSuccess<TData = unknown> {
  id: string;
  ok: true;
  data: TData;
}

export interface RpcFailure {
  id: string;
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type RpcResponse<TData = unknown> = RpcSuccess<TData> | RpcFailure;

export interface HelloParams {
  clientName: string;
  clientVersion: string;
  protocolVersion: string;
}

export interface Capabilities {
  bridgeVersion: string;
  protocolVersion: string;
  features: BridgeFeature[];
  socketPath: string;
  homeKitReady: boolean;
}

export interface Status {
  ready: boolean;
  bridgeVersion: string;
  protocolVersion: string;
  homes: number;
  accessories: number;
  socketPath: string;
  cache: {
    warmed: boolean;
    accessoryCount: number;
    updatedAt?: string;
  };
}

export interface HomeSummary {
  id: string;
  name: string;
  primary: boolean;
}

export interface RoomSummary {
  id: string;
  name: string;
  homeId: string;
  homeName: string;
  accessoryCount: number;
}

export interface ZoneSummary {
  id: string;
  name: string;
  homeId: string;
  homeName: string;
  roomCount: number;
  rooms?: RoomSummary[];
}

export interface CharacteristicSummary {
  id: string;
  type: string;
  name: string;
  value?: unknown;
  writable: boolean;
}

export interface ServiceSummary {
  id: string;
  type: string;
  name: string;
  characteristics: CharacteristicSummary[];
}

export interface AccessorySummary {
  id: string;
  name: string;
  homeId: string;
  homeName: string;
  roomId?: string;
  roomName?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  reachable?: boolean;
  services?: ServiceSummary[];
}

export interface SceneSummary {
  id: string;
  name: string;
  homeId: string;
  homeName: string;
  actionCount: number;
}

export interface AutomationSummary {
  id: string;
  name: string;
  homeId: string;
  homeName: string;
  enabled: boolean;
  eventCount: number;
  actionSetCount: number;
  scenes: string[];
  eventSummary?: string;
}

export interface EventSummary {
  id: string;
  date: string;
  type: string;
  homeName?: string;
  accessoryName?: string;
  characteristic?: string;
  value?: unknown;
  message: string;
}

export interface WebhookTriggerSummary {
  id: string;
  label: string;
  enabled: boolean;
  events?: string[];
  accessories?: string[];
  scenes?: string[];
  characteristics?: string[];
}

export interface ControlParams {
  accessoryId: string;
  characteristic: string;
  value: string;
  serviceType?: string;
  allowActuation: boolean;
}

export interface ControlResult {
  auditId: string;
  accessoryId: string;
  characteristic: string;
  accepted: boolean;
  dryRun: false;
}

export interface MutationResult {
  auditId: string;
  accepted: boolean;
  dryRun: boolean;
  id?: string;
  name?: string;
  oldName?: string;
  newName?: string;
  homeId?: string;
  homeName?: string;
}

export function majorVersion(version: string): string {
  return version.split(".")[0] ?? version;
}

export function protocolMajorMatches(a: string, b: string): boolean {
  return majorVersion(a) === majorVersion(b);
}

export interface HomeClawRequest {
  command: string;
  args?: Record<string, unknown>;
}

export interface HomeClawSuccess<TData = unknown> {
  success: true;
  data: TData;
}

export interface HomeClawFailure {
  success: false;
  error: string;
}

export type HomeClawResponse<TData = unknown> =
  | HomeClawSuccess<TData>
  | HomeClawFailure;

export function encodeRequest(request: HomeClawRequest): string {
  return `${JSON.stringify(request)}\n`;
}

export function decodeResponse<T>(raw: string): HomeClawResponse<T> {
  const parsed = JSON.parse(raw) as HomeClawResponse<T>;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.success !== "boolean"
  ) {
    throw new Error("Invalid bridge response envelope");
  }
  return parsed;
}
