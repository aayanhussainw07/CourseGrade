"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";

const courseColorOptions = [
  { id: "default", label: "Default", color: "" },
  { id: "frost", label: "Frost", color: "rgba(255, 255, 255, 0.1)" },
  { id: "smoke", label: "Smoke", color: "rgba(255, 255, 255, 0.08)" },
  { id: "pewter", label: "Pewter", color: "rgba(235, 235, 235, 0.06)" },
  { id: "graphite", label: "Graphite", color: "rgba(170, 170, 170, 0.12)" },
  { id: "charcoal", label: "Charcoal", color: "rgba(120, 120, 120, 0.14)" },
  { id: "ash", label: "Ash", color: "rgba(90, 90, 90, 0.15)" },
  { id: "slate", label: "Slate", color: "rgba(70, 70, 70, 0.16)" },
  { id: "steel", label: "Steel", color: "rgba(50, 50, 50, 0.18)" },
  { id: "ink", label: "Ink", color: "rgba(30, 30, 30, 0.2)" },
  { id: "obsidian", label: "Obsidian", color: "rgba(12, 12, 12, 0.24)" },
];

interface CourseColorPickerProps {
  currentColor: string | null | undefined;
  onChange: (color: string) => void;
}

export function CourseColorPicker({ currentColor, onChange }: CourseColorPickerProps) {
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
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={() => setOpen((prev) => !prev)}
        title="Card Color"
      >
        <Palette className="h-4 w-4" />
      </Button>
      {open && (
        <div
          ref={ref}
          className="absolute right-0 top-10 z-20 min-w-[160px] rounded-xl border border-border/60 bg-card/95 p-3"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Card Color
          </p>
          <div className="grid grid-cols-4 gap-2">
            {courseColorOptions.map((option) => {
              const isActive = (currentColor ?? "") === (option.color ?? "");
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onChange(option.color)}
                  className={`h-6 w-6 rounded-full border-2 transition hover:scale-105 ${
                    isActive ? "border-foreground" : "border-border/40"
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
