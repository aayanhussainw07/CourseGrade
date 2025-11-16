# Google AdSense Integration

CourseGrade now has a built-in AdSense setup for both the global script loader and reusable ad slots.

## Environment variables

Add the following variables to `.env.local` (they are already ignored by git):

```
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXX
NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT=1234567890
```

- `NEXT_PUBLIC_ADSENSE_CLIENT` is required for any AdSense script to run.
- `NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT` is optional; when present, the left sidebar renders a responsive ad unit automatically.

Restart `next dev` after editing env files so the client build picks up the new values.

### ads.txt verification

AdSense accepts the ads.txt method for site verification and supply chain transparency. The repo now ships `public/ads.txt` with the Google directive:

```
google.com, pub-3111454697171705, DIRECT, f08c47fec0942fa0
```

When deployed, Next.js serves this at `https://<your-domain>/ads.txt`. Update the publisher ID if it changes, and redeploy so Google’s crawler can read it.

## Rendering ads elsewhere

Use the `AdSenseUnit` component for additional placements:

```tsx
import { AdSenseUnit } from "@/components/adsense-unit";

export function Example() {
  return (
    <AdSenseUnit
      slot="0987654321"
      className="my-6"
      format="auto"
      layout="in-article"
    />
  );
}
```

The component automatically pushes ads when the global AdSense script is available and no-ops in development if the environment variables are missing.
