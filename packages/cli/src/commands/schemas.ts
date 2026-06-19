import { z } from "incur";

export const homeOption = z.object({
  homeId: z
    .string()
    .optional()
    .describe("Home UUID. Defaults to the bridge-selected primary home."),
});

export const statusOutput = z.object({
  ready: z.boolean(),
  bridgeVersion: z.string(),
  protocolVersion: z.string(),
  homes: z.number(),
  accessories: z.number(),
  socketPath: z.string(),
  cache: z.object({
    warmed: z.boolean(),
    accessoryCount: z.number(),
    updatedAt: z.string().optional(),
  }),
});

export const homeSummary = z.object({
  id: z.string(),
  name: z.string(),
  primary: z.boolean(),
});

export const roomSummary = z.object({
  id: z.string(),
  name: z.string(),
  homeId: z.string(),
  homeName: z.string(),
  accessoryCount: z.number(),
});

export const accessorySummary = z.object({
  id: z.string(),
  name: z.string(),
  homeId: z.string(),
  homeName: z.string(),
  roomId: z.string().optional(),
  roomName: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  firmwareVersion: z.string().optional(),
  reachable: z.boolean().optional(),
});

export const sceneSummary = z.object({
  id: z.string(),
  name: z.string(),
  homeId: z.string(),
  homeName: z.string(),
  actionCount: z.number(),
});

export const zoneSummary = z.object({
  id: z.string(),
  name: z.string(),
  homeId: z.string(),
  homeName: z.string(),
  roomCount: z.number(),
  rooms: z.array(roomSummary).optional(),
});

export const automationSummary = z.object({
  id: z.string(),
  name: z.string(),
  homeId: z.string(),
  homeName: z.string(),
  enabled: z.boolean(),
  eventCount: z.number(),
  actionSetCount: z.number(),
  scenes: z.array(z.string()),
  eventSummary: z.string().optional(),
});

export const eventSummary = z.object({
  id: z.string(),
  date: z.string(),
  type: z.string(),
  homeName: z.string().optional(),
  accessoryName: z.string().optional(),
  characteristic: z.string().optional(),
  value: z.unknown().optional(),
  message: z.string(),
});

export const mutationOptions = z.object({
  allowMutation: z
    .boolean()
    .default(false)
    .describe(
      "Required. Confirms HomeKit structure or automation state may change.",
    ),
  dryRun: z.boolean().default(false).describe("Validate without applying."),
});

export const mutationResult = z.object({
  auditId: z.string(),
  accepted: z.boolean(),
  dryRun: z.boolean(),
  id: z.string().optional(),
  name: z.string().optional(),
  oldName: z.string().optional(),
  newName: z.string().optional(),
  homeId: z.string().optional(),
  homeName: z.string().optional(),
});
