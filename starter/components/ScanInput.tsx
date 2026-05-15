"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface ScanInputProps {
  onScan: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
  onEscape?: () => void;
}

export interface ScanInputHandle {
  focus(): void;
  clear(): void;
}

// Forward-ref so parent flows can re-focus the input after a successful
// commit without remounting the component. That's how continuous-scan mode
// works: success banner stays, focus jumps back to the input.
export const ScanInput = forwardRef<ScanInputHandle, ScanInputProps>(
  function ScanInput(
    {
      onScan,
      placeholder = "Scan or type a tag and press Enter…",
      autoFocus = true,
      disabled = false,
      label,
      onEscape,
    },
    handle,
  ) {
    const ref = useRef<HTMLInputElement>(null);

    useImperativeHandle(handle, () => ({
      focus: () => ref.current?.focus(),
      clear: () => {
        if (ref.current) ref.current.value = "";
      },
    }));

    useEffect(() => {
      if (autoFocus && ref.current && !disabled) {
        ref.current.focus();
      }
    }, [autoFocus, disabled]);

    function fire(): void {
      const el = ref.current;
      if (!el) return;
      const v = el.value.trim();
      if (!v) return;
      onScan(v);
      el.value = "";
      el.focus();
    }

    return (
      <label className="block">
        {label ? (
          <span className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </span>
        ) : null}
        <input
          ref={ref}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full text-lg p-4 min-h-[44px] rounded-lg border-2 border-gray-300 focus:border-blue-600 focus:outline-none disabled:bg-gray-100"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              fire();
            } else if (e.key === "Escape" && onEscape) {
              e.preventDefault();
              const el = ref.current;
              if (el) el.value = "";
              onEscape();
            }
          }}
        />
      </label>
    );
  },
);
