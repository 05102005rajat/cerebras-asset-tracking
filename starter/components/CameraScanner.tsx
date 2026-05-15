"use client";

import { useEffect, useRef, useState } from "react";

// Camera-driven scanning. Hidden behind a button so the page stays usable when
// the tech is on a desktop with a wedge scanner — no permission prompt unless
// they actually need the camera.
export function CameraScanner({
  open,
  onClose,
  onDecode,
}: {
  open: boolean;
  onClose: () => void;
  onDecode: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        // Lazy import — keeps the bundle small for non-camera flows.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;

        const reader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;

        // Prefer rear-facing camera.
        const back =
          devices.find((d) => /back|rear|environment/i.test(d.label)) ??
          devices[0];

        if (!back) {
          setError("No camera detected on this device.");
          return;
        }

        const controls = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current!,
          (result, _err, ctrls) => {
            if (cancelled) {
              ctrls.stop();
              return;
            }
            if (result) {
              const text = result.getText();
              ctrls.stop();
              onDecode(text);
              onClose();
            }
          },
        );
        stopRef.current = () => controls.stop();
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : "Could not start the camera. Check the browser permission.",
        );
      }
    })();

    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
      setReady(false);
    };
  }, [open, onDecode, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Camera scanner"
    >
      <div className="flex justify-between items-center p-4">
        <div className="text-white text-sm font-medium">
          {ready ? "Point camera at the barcode" : "Starting camera…"}
        </div>
        <button
          onClick={onClose}
          className="text-white px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm font-medium min-h-[44px]"
        >
          Cancel
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="text-red-300 text-center max-w-sm text-sm">
            {error}
          </div>
        ) : (
          <div className="relative w-full max-w-md aspect-square">
            <video
              ref={videoRef}
              className="w-full h-full object-cover rounded-lg bg-black"
              playsInline
              muted
            />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-3/4 h-1/3 border-2 border-white/70 rounded" />
            </div>
          </div>
        )}
      </div>
      <div className="text-center text-white/70 text-xs pb-6 px-4">
        Decodes Code 128, QR, and most 2D formats. Hold steady.
      </div>
    </div>
  );
}
