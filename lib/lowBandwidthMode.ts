"use client";

/**
 * lib/lowBandwidthMode.ts
 *
 * Low-bandwidth mode detection and manual toggle.
 *
 * Auto-detect: navigator.connection.effectiveType === '2g' OR downlink < 0.5 Mbps.
 * Manual toggle: stored in localStorage under key "llbm" (liberialearn-bandwidth-mode).
 *   "0" = user explicitly disabled  (even if auto-detect would be on)
 *   "1" = user explicitly enabled
 *   absent = follow auto-detect
 *
 * In low-bandwidth mode the HTML element carries data-lowbandwidth="true"
 * so CSS can suppress images, animations, and transitions without JS re-renders.
 */

const STORAGE_KEY = "llbm";
const HTML_ATTR = "data-lowbandwidth";

type Listener = (enabled: boolean) => void;
const listeners = new Set<Listener>();

/** Detect network conditions without relying on a manual override. */
function detectFromConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;
  if (!conn) return false;
  if (conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") return true;
  if (typeof conn.downlink === "number" && conn.downlink > 0 && conn.downlink < 0.5) return true;
  return false;
}

/** Resolve current mode: manual override wins; then auto-detect. */
export function getLowBandwidthMode(): boolean {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  }
  return detectFromConnection();
}

/** Manually set the mode and persist to localStorage. */
export function setLowBandwidthMode(enabled: boolean): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  }
  applyHtmlAttr(enabled);
  listeners.forEach((cb) => cb(enabled));
}

/** Clear manual override and return to auto-detect. */
export function clearLowBandwidthOverride(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  const detected = detectFromConnection();
  applyHtmlAttr(detected);
  listeners.forEach((cb) => cb(detected));
}

/** Subscribe to changes (returns unsubscribe function). */
export function subscribeLowBandwidth(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Apply / remove the HTML attribute so CSS can react. */
function applyHtmlAttr(enabled: boolean): void {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.setAttribute(HTML_ATTR, "true");
  } else {
    document.documentElement.removeAttribute(HTML_ATTR);
  }
}

/**
 * Bootstrap: read initial state and wire the Network Information API listener.
 * Should be called once from LowBandwidthModeScript or a client layout.
 */
export function initLowBandwidthMode(): void {
  if (typeof window === "undefined") return;
  applyHtmlAttr(getLowBandwidthMode());

  const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;
  if (conn && typeof conn.addEventListener === "function") {
    conn.addEventListener("change", () => {
      // Only update if user has no manual override
      if (localStorage.getItem(STORAGE_KEY) === null) {
        const next = detectFromConnection();
        applyHtmlAttr(next);
        listeners.forEach((cb) => cb(next));
      }
    });
  }
}
