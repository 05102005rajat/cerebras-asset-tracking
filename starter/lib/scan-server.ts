import { ApiError, api } from "./api-client";
import { locationToFacilitiesString } from "./locations";
import type {
  Asset,
  DeployScanInput,
  ReceiveScanInput,
  StoreScanInput,
  TransferScanInput,
} from "./types";

// Side-effects we surface back to the UI so the tech can see what writes
// happened beyond the operational scan itself. Intentionally non-fatal:
// the scan is the source of truth, downstream writes are best-effort, but
// we tell the tech if one failed so they can flag it.
export type SideEffect = {
  system: "facilities" | "finance";
  ok: boolean;
  action: string;
  error?: string;
};

export type ScanResult = {
  asset: Asset;
  side_effects: SideEffect[];
};

async function tryWrite(
  system: "facilities" | "finance",
  action: string,
  fn: () => Promise<unknown>,
): Promise<SideEffect> {
  try {
    await fn();
    return { system, ok: true, action };
  } catch (e) {
    return {
      system,
      ok: false,
      action,
      error: e instanceof ApiError ? `${e.code}: ${e.message}` : String(e),
    };
  }
}

export async function performReceive(
  input: ReceiveScanInput,
): Promise<ScanResult> {
  const asset = await api.scans.receive(input);
  // Receive does not write to facilities or finance — finance keeps the
  // pre-existing pending_receipt row until deploy capitalizes it, and
  // facilities only tracks racked items.
  return { asset, side_effects: [] };
}

export async function performStore(
  input: StoreScanInput,
  // We need to know whether this was an in_service → stored transition,
  // because that's the only store-direction that triggers a facilities
  // de-rack write. The caller resolves the prior state from the asset
  // record they fetched for the pre-commit summary.
  priorState: string | null,
): Promise<ScanResult> {
  const asset = await api.scans.store(input);
  const sideEffects: SideEffect[] = [];

  if (priorState === "in_service") {
    sideEffects.push(
      await tryWrite(
        "facilities",
        "Removed from rack (de-rack)",
        () =>
          api.mock.updateFacilities({
            tagged_id: input.asset_tag,
            rack_location: null,
          }),
      ),
    );
  }

  return { asset, side_effects: sideEffects };
}

export async function performDeploy(
  input: DeployScanInput,
): Promise<ScanResult> {
  const asset = await api.scans.deploy(input);
  const sideEffects: SideEffect[] = [];

  sideEffects.push(
    await tryWrite("facilities", "Updated rack location", () =>
      api.mock.updateFacilities({
        tagged_id: input.asset_tag,
        rack_location: locationToFacilitiesString(input.location),
      }),
    ),
  );

  sideEffects.push(
    await tryWrite("finance", "Capitalized", () =>
      api.mock.updateFinance({
        tag: input.asset_tag,
        site: input.location.site,
        status: "capitalized",
        capitalized_on: new Date().toISOString().slice(0, 10),
      }),
    ),
  );

  return { asset, side_effects: sideEffects };
}

export async function performTransfer(
  input: TransferScanInput,
): Promise<ScanResult> {
  const asset = await api.scans.transfer(input);
  // Transfer changes custodian only — no facilities/finance writes.
  return { asset, side_effects: [] };
}
