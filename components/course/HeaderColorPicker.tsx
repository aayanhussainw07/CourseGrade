"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paintbrush } from "lucide-react";
import { HEADER_COLOR_OPTIONS } from "@/lib/header-colors";
import { cn } from "@/lib/utils";

interface HeaderColorPickerProps {
  currentColor: string | null | undefined;
  onChange: (color: string) => void;
  side?: "top" | "bottom";
}

export function HeaderColorPicker({
  currentColor,
  onChange,
  side = "bottom",
}: HeaderColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative z-30">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={() => setOpen((prev) => !prev)}
        title="Header Color"
      >
        <Paintbrush className="h-4 w-4" style={currentColor ? { color: currentColor } : undefined} />
      </Button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-[80] min-w-[180px] rounded-xl border border-border/60 bg-card/95 p-3 shadow-[0_8px_18px_rgba(92,30,26,0.14)]",
            side === "top" ? "bottom-10" : "top-10",
          )}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Header Color
          </p>
          <div className="grid grid-cols-5 gap-2">
            {HEADER_COLOR_OPTIONS.map((option) => {
              const isActive = (currentColor ?? "") === (option.color ?? "");
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { onChange(option.color); setOpen(false); }}
                  className={`h-6 w-6 rounded-full border-2 transition hover:scale-110 ${
                    isActive ? "border-foreground ring-2 ring-foreground/20" : "border-border/40"
                  }`}
                  style={{ backgroundColor: option.color || "transparent" }}
                  title={option.label}
                >
                  {option.color === "" && (
                    <span className="block h-full w-full rounded-full bg-muted" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
