/**
 * firetv/detect.ts
 *
 * Utility to detect Amazon Fire TV environment.
 * Fire TV's Silk browser uses a user-agent string containing "Silk/" and
 * "AFTM" / "AFTT" / "AFTS" etc.  We also check for the "KFFOWI" (Fire TV
 * Stick Lite) and similar model identifiers.
 *
 * For development on a desktop, set `?firetv=1` in the URL to force the
 * Fire TV mode.
 */

const UA = typeof navigator !== "undefined" ? navigator.userAgent : "";

/** Full list of known Fire TV model prefixes in user-agent strings */
const FIRE_TV_MODELS = [
  "AFT",   // Generic Fire TV prefix (AFTM, AFTT, AFTS, AFTN, AFTB, etc.)
  "KFFOWI", // Fire TV Stick Lite
  "KFMAWI", // Fire TV Stick 4K
];

export function isFireTV(): boolean {
  // URL override for development
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("firetv") === "1") {
      return true;
    }
  }
  // Check user-agent
  return (
    UA.includes("Silk/") ||
    FIRE_TV_MODELS.some((model) => UA.includes(model))
  );
}

/**
 * Returns resolution hints for Fire TV devices.
 * Most Fire TVs output 1080p; Fire TV Stick Lite outputs 1080p but the
 * older sticks were 720p.
 */
export function getFireTVResolution(): { width: number; height: number } {
  if (typeof window !== "undefined") {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return { width: 1920, height: 1080 };
}
