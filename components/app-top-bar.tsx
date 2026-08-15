"use client";

import { Menu } from "lucide-react";
import { SheetTrigger } from "@/components/ui/sheet";

export type TopBarDestination = "dashboard" | "settings";

const SIDEBAR_PATTERN =
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)";

interface AppTopBarProps {
  activeItem: TopBarDestination | null;
  onDashboard: () => void;
  onSettings: () => void;
  showOverview?: boolean;
}

export function AppTopBar({
  activeItem,
  onDashboard,
  onSettings,
  showOverview = false,
}: AppTopBarProps) {
  const navigation: Array<{
    id: TopBarDestination;
    label: string;
    action: () => void;
    backgroundRotation: string;
  }> = [
    {
      id: "dashboard",
      label: "Dashboard",
      action: onDashboard,
      backgroundRotation: "rotate-[-1deg]",
    },
    {
      id: "settings",
      label: "Settings",
      action: onSettings,
      backgroundRotation: "rotate-[1deg]",
    },
  ];

  return (
    <nav
      data-app-navigation
      aria-label="Primary navigation"
      className="fixed left-2 top-3 z-[70] flex items-center gap-1 whitespace-nowrap text-xs font-semibold md:left-[13.5rem] md:gap-2 md:text-sm lg:left-[16.5rem] print:hidden"
    >
      {showOverview && (
        <SheetTrigger asChild>
          <button
            type="button"
            className="relative isolate px-2 py-1.5 text-white opacity-80 underline-offset-[5px] transition-opacity hover:opacity-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 data-[state=open]:opacity-100 data-[state=open]:underline md:hidden"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 rotate-[-0.75deg] bg-foreground"
              style={{ backgroundImage: SIDEBAR_PATTERN }}
            />
            <span className="relative z-10 flex items-center gap-1.5">
              <Menu className="h-3.5 w-3.5" />
              Overview
            </span>
          </button>
        </SheetTrigger>
      )}
      {navigation.map((item) => {
        const active = activeItem === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={item.action}
            className={`relative isolate border-0 px-2 py-1.5 text-white underline-offset-[5px] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:px-3 ${
              active
                ? "underline decoration-2"
                : "opacity-80 hover:opacity-100 hover:underline"
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 z-0 bg-foreground ${item.backgroundRotation}`}
              style={{ backgroundImage: SIDEBAR_PATTERN }}
            />
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
