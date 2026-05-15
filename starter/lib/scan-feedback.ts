// Side-channel feedback for the tech that doesn't depend on them looking at
// the screen — phones vibrate, voiceovers announce. The visual banner already
// exists; this just makes it richer when the device supports it.
export function tactileSuccess(): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  // Short double-pulse — distinct from the longer single buzz we use for
  // errors. Tech learns the difference within a shift.
  navigator.vibrate([30, 40, 30]);
}

export function tactileError(): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  navigator.vibrate([120]);
}
