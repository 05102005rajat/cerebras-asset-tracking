import type { Location } from "./types";

// Two-way encoding for location barcodes the techs can scan.
//
// Format: `LOC|site|room|row|rack|ru` — pipe-delimited, missing parts are empty.
// Lossless: facilities uses `site/room/row/rack/ru` (slash-delimited, null fields
// dropped) which we never round-trip back through.
export const LOC_PREFIX = "LOC|";
export const BADGE_PREFIX = "BADGE|";

export function isLocationPayload(s: string): boolean {
  return s.startsWith(LOC_PREFIX);
}

export function isBadgePayload(s: string): boolean {
  return s.startsWith(BADGE_PREFIX);
}

export function isAssetTag(s: string): boolean {
  return /^C\d{7}$/.test(s);
}

export function parseLocationPayload(payload: string): Location | null {
  if (!isLocationPayload(payload)) return null;
  const parts = payload.slice(LOC_PREFIX.length).split("|");
  if (parts.length !== 5) return null;
  const [site, room, row, rack, ru] = parts;
  if (!site) return null;
  return {
    site,
    room: room || null,
    row: row || null,
    rack: rack || null,
    ru: ru || null,
  };
}

export function parseBadgePayload(payload: string): string | null {
  if (!isBadgePayload(payload)) return null;
  const v = payload.slice(BADGE_PREFIX.length).trim();
  return v.length > 0 ? v : null;
}

export function encodeLocationPayload(loc: Location): string {
  return [
    LOC_PREFIX.slice(0, -1),
    loc.site,
    loc.room ?? "",
    loc.row ?? "",
    loc.rack ?? "",
    loc.ru ?? "",
  ].join("|");
}

export function encodeBadgePayload(userId: string): string {
  return BADGE_PREFIX + userId;
}

export function formatLocation(loc: Location | null | undefined): string {
  if (!loc) return "—";
  const parts = [loc.site, loc.room, loc.row, loc.rack, loc.ru].filter(
    (p): p is string => Boolean(p),
  );
  return parts.length > 0 ? parts.join(" / ") : "—";
}

// Facilities mock uses `site/room/row/rack/ru`. We collapse missing trailing
// segments so the comparison matches its serialization.
export function locationToFacilitiesString(loc: Location): string {
  const parts = [loc.site, loc.room, loc.row, loc.rack, loc.ru].map((p) =>
    p ?? "",
  );
  return parts.join("/");
}

export function isCompleteDeployLocation(loc: Location): boolean {
  return Boolean(loc.site && loc.room && loc.rack && loc.ru);
}

export function emptyLocation(site = ""): Location {
  return { site, room: null, row: null, rack: null, ru: null };
}
