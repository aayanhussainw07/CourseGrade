"use client";

import Script from "next/script";

const ADSENSE_CLIENT = "ca-pub-3111454697171705";

/**
 * Loads the Google AdSense script. Render this ONLY on public pages that
 * contain real publisher content (e.g. the marketing landing page). Do NOT
 * mount it in the root layout — that would load ads on auth, dashboard, and
 * tool screens with no publisher content, which violates AdSense policy.
 */
export function AdSenseLoader() {
  return (
    <Script
      id="adsense-loader"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  );
}
