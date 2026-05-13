import { z } from "zod";

export const ASSET_TAG_REGEX = /^C\d{7}$/;

export const AssetClassSchema = z.enum([
  "instrument",
  "compute",
  "network",
  "power",
  "consumable_durable",
]);
export type AssetClass = z.infer<typeof AssetClassSchema>;

export const AssetStateSchema = z.enum([
  "unreceived",
  "received",
  "stored",
  "in_service",
  "rma_pending",
  "disposed",
]);
export type AssetState = z.infer<typeof AssetStateSchema>;

export const EventTypeSchema = z.enum([
  "receive",
  "store",
  "deploy",
  "rma_open",
  "rma_receive_back",
  "dispose",
  "duplicate_receive",
  "transfer_custody",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const LocationSchema = z.object({
  site: z.string().min(1),
  room: z.string().min(1).nullable(),
  row: z.string().min(1).nullable(),
  rack: z.string().min(1).nullable(),
  ru: z.string().min(1).nullable(),
});
export type Location = z.infer<typeof LocationSchema>;

export const AssetSchema = z.object({
  asset_tag: z.string().regex(ASSET_TAG_REGEX),
  serial: z.string(),
  model: z.string(),
  manufacturer: z.string(),
  asset_class: AssetClassSchema,
  state: AssetStateSchema,
  location: LocationSchema,
  custodian: z.string(),
  parent_asset_tag: z.string().nullable(),
  procurement_note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const EventSchema = z.object({
  id: z.string(),
  asset_tag: z.string(),
  event_type: EventTypeSchema,
  from_state: AssetStateSchema.nullable(),
  to_state: AssetStateSchema,
  from_location: LocationSchema.nullable(),
  to_location: LocationSchema,
  user_id: z.string(),
  scan_payload: z.string(),
  timestamp: z.string(),
});
export type Event = z.infer<typeof EventSchema>;

export const ReceiveScanInputSchema = z.object({
  asset_tag: z.string(),
  serial: z.string().min(1),
  model: z.string().min(1),
  manufacturer: z.string().min(1),
  asset_class: AssetClassSchema,
  location: LocationSchema,
  user_id: z.string().min(1),
  scan_payload: z.string(),
});
export type ReceiveScanInput = z.infer<typeof ReceiveScanInputSchema>;

export const StoreScanInputSchema = z.object({
  asset_tag: z.string(),
  location: LocationSchema,
  user_id: z.string().min(1),
  scan_payload: z.string(),
});
export type StoreScanInput = z.infer<typeof StoreScanInputSchema>;

export const DeployScanInputSchema = z.object({
  asset_tag: z.string(),
  location: LocationSchema,
  user_id: z.string().min(1),
  scan_payload: z.string(),
});
export type DeployScanInput = z.infer<typeof DeployScanInputSchema>;

export const TransferScanInputSchema = z.object({
  asset_tag: z.string(),
  to_custodian: z.string().min(1),
  user_id: z.string().min(1),
  scan_payload: z.string(),
});
export type TransferScanInput = z.infer<typeof TransferScanInputSchema>;

export const FacilitiesUpdateSchema = z.object({
  tagged_id: z.string(),
  rack_location: z.string().nullable(),
});
export type FacilitiesUpdate = z.infer<typeof FacilitiesUpdateSchema>;

export const FinanceUpdateSchema = z.object({
  tag: z.string(),
  site: z.string().optional(),
  status: z.enum(["capitalized", "pending_receipt", "retired", "impaired"]),
  book_value_usd: z.number().optional(),
  capitalized_on: z.string().nullable().optional(),
});
export type FinanceUpdate = z.infer<typeof FinanceUpdateSchema>;

export type FacilitiesRecord = {
  space_id: string;
  tagged_id: string;
  rack_location: string;
  last_observed: string;
};

export type FinanceRecord = {
  finance_id: string;
  tag: string;
  site: string;
  book_value_usd: number;
  status: "capitalized" | "pending_receipt" | "retired" | "impaired";
  capitalized_on: string | null;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
