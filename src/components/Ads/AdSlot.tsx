export interface AdSlotProps {
  /** Stable id for this placement (kept for call-site compatibility). */
  slot?: string;
  className?: string;
}

/**
 * No-op inside the app.
 *
 * The planner is a tool with no article content, and AdSense forbids serving ads
 * on screens without publisher content. Ads therefore run ONLY on the static
 * content pages under `/guides/*` (which load the AdSense script themselves).
 * This component is kept as a no-op so the existing dialog call sites don't need
 * to be edited.
 */
export function AdSlot(_props: AdSlotProps): null {
  return null;
}
