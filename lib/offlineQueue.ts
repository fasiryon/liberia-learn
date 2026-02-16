"use client";

import { trackEvent, EVENTS } from "@/lib/trackEvent";

export async function offlineFetch(
  url: string,
  options?: RequestInit
): Promise<Response | { queued: true; offline: true }> {
  try {
    const res = await fetch(url, options);
    return res;
  } catch {
    // Network error — dispatch event for UI listeners
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ll:queued", { detail: { url } }));
    }

    // Track the appropriate offline event
    if (url.includes("/api/homework")) {
      trackEvent(EVENTS.HOMEWORK_SUBMIT_OFFLINE, { url });
    } else if (url.includes("/api/ai/chat")) {
      trackEvent(EVENTS.TUTOR_OFFLINE, { url });
    }

    return { queued: true, offline: true };
  }
}
