"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ScanInput, type ScanInputHandle } from "./ScanInput";
import { CameraScanner } from "./CameraScanner";

export interface ScanFieldHandle {
  focus(): void;
}

interface ScanFieldProps {
  onScan: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  onEscape?: () => void;
}

// Wraps ScanInput with a camera button. Same callback shape so scan workflows
// don't need to know whether the tech is on a phone or wedge.
export const ScanField = forwardRef<ScanFieldHandle, ScanFieldProps>(
  function ScanField(
    { onScan, label, placeholder, disabled, hint, onEscape },
    handle,
  ) {
    const [cameraOpen, setCameraOpen] = useState(false);
    const scanRef = useRef<ScanInputHandle>(null);

    useImperativeHandle(handle, () => ({
      focus: () => scanRef.current?.focus(),
    }));

    return (
      <div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <ScanInput
              ref={scanRef}
              onScan={onScan}
              label={label}
              placeholder={placeholder}
              disabled={disabled}
              onEscape={onEscape}
            />
          </div>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={disabled}
            className="min-h-[60px] px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Open camera scanner"
            title="Use phone camera"
          >
            📷
          </button>
        </div>
        {hint ? <p className="text-xs text-gray-500 mt-1.5">{hint}</p> : null}
        <CameraScanner
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onDecode={(text) => onScan(text.trim())}
        />
      </div>
    );
  },
);
