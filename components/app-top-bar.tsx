"use client";

export type TopBarDestination = "dashboard" | "settings";

interface AppTopBarProps {
  activeItem: TopBarDestination | null;
  onDashboard: () => void;
  onSettings: () => void;
}

export function AppTopBar({
  activeItem,
  onDashboard,
  onSettings,
}: AppTopBarProps) {
  const navigation: Array<{
    id: TopBarDestination;
    label: string;
    action: () => void;
  }> = [
    { id: "dashboard", label: "Dashboard", action: onDashboard },
    { id: "settings", label: "Settings", action: onSettings },
  ];

  return (
    <nav
      data-app-navigation
      aria-label="Primary navigation"
      className="fixed left-11 top-3 z-[70] flex items-center gap-2 whitespace-nowrap text-sm font-semibold md:left-[15.75rem] lg:left-[18.75rem] print:hidden"
    >
      {navigation.map((item) => {
        const active = activeItem === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={item.action}
            className={`rounded-md border-0 bg-foreground px-3 py-1.5 text-white underline-offset-[5px] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              active
                ? "underline decoration-2"
                : "opacity-80 hover:opacity-100 hover:underline"
            }`}
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px)",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
