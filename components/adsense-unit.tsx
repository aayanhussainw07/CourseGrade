"use client";

import { useEffect } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdSenseUnitProps {
  slot: string;
  className?: string;
  format?: string;
  layout?: string;
  layoutKey?: string;
  responsive?: boolean;
  style?: CSSProperties;
}

export function AdSenseUnit({
  slot,
  className,
  format = "auto",
  layout,
  layoutKey,
  responsive = true,
  style,
}: AdSenseUnitProps) {
  const adSenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  useEffect(() => {
    if (!adSenseClient || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error("Failed to load AdSense ad", error);
    }
  }, [adSenseClient, slot]);

  if (!adSenseClient) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "AdSense client ID missing. Set NEXT_PUBLIC_ADSENSE_CLIENT to render ads."
      );
    }
    return null;
  }

  return (
    <ins
      className={cn("adsbygoogle block", className)}
      style={{
        display: "block",
        minHeight: 90,
        ...style,
      }}
      data-ad-client={adSenseClient}
      data-ad-slot={slot}
      data-ad-format={format}
      data-ad-layout={layout}
      data-ad-layout-key={layoutKey}
      data-full-width-responsive={responsive ? "true" : undefined}
    />
  );
}
