import { ApiError } from "./api-client";
import {
  isAssetTag,
  isBadgePayload,
  isLocationPayload,
} from "./locations";

// Single source of truth for the "is this what I expected?" check on tag
// inputs. Returns null when the input is a valid asset tag; otherwise an
// ApiError with a context-specific message — a location payload, a badge,
// or a malformed tag each get their own guidance instead of one generic
// "invalid_tag_format" error.
export function validateAssetTagScan(value: string): ApiError | null {
  if (isAssetTag(value)) return null;
  if (isLocationPayload(value)) {
    return new ApiError(
      400,
      "wrong_scan_type_location",
      `You scanned a location label ("${value.slice(0, 40)}…") where the asset tag goes.`,
    );
  }
  if (isBadgePayload(value)) {
    return new ApiError(
      400,
      "wrong_scan_type_badge",
      `You scanned a badge ("${value}") where the asset tag goes.`,
    );
  }
  return new ApiError(
    400,
    "invalid_tag_format",
    `"${value}" doesn't look like a tag. Tags are C followed by 7 digits.`,
  );
}
