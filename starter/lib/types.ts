export type AssetClass =
  | "instrument"
  | "compute"
  | "network"
  | "power"
  | "consumable_durable";

export type AssetState =
  | "unreceived"
  | "received"
  | "stored"
  | "in_service"
  | "rma_pending"
  | "disposed";

export type EventType =
  | "receive"
  | "store"
  | "deploy"
  | "rma_open"
  | "rma_receive_back"
  | "dispose"
  | "duplicate_receive"
  | "transfer_custody";

export type Location = {
  site: string;
  room: string | null;
  row: string | null;
  rack: string | null;
  ru: string | null;
};

export type Asset = {
  asset_tag: string;
  serial: string;
  model: string;
  manufacturer: string;
  asset_class: AssetClass;
  state: AssetState;
  location: Location;
  custodian: string;
  parent_asset_tag: string | null;
  procurement_note: string | null;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  asset_tag: string;
  event_type: EventType;
  from_state: AssetState | null;
  to_state: AssetState;
  from_location: Location | null;
  to_location: Location;
  user_id: string;
  scan_payload: string;
  timestamp: string;
};

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

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ReceiveScanInput = {
  asset_tag: string;
  serial: string;
  model: string;
  manufacturer: string;
  asset_class: AssetClass;
  location: Location;
  user_id: string;
  scan_payload: string;
};

export type StoreScanInput = {
  asset_tag: string;
  location: Location;
  user_id: string;
  scan_payload: string;
};

export type DeployScanInput = {
  asset_tag: string;
  location: Location;
  user_id: string;
  scan_payload: string;
};

export type TransferScanInput = {
  asset_tag: string;
  to_custodian: string;
  user_id: string;
  scan_payload: string;
};

export type FacilitiesUpdate = {
  tagged_id: string;
  rack_location: string | null;
};

export type FinanceUpdate = {
  tag: string;
  site?: string;
  status: "capitalized" | "pending_receipt" | "retired" | "impaired";
  book_value_usd?: number;
  capitalized_on?: string | null;
};

export type AssetListFilters = {
  state?: AssetState | string;
  site?: string;
  custodian?: string;
};
