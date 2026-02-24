/**
 * Accessibility mode — pure persistence helpers.
 *
 * When enabled, adds data-a11y="true" to <html> so global CSS rules
 * in globals.css can apply larger text and more spacious layout.
 *
 * All functions are DOM-guarded for SSR / node test safety.
 */

export const A11Y_STORAGE_KEY = "ll_a11y_mode";
export const A11Y_HTML_ATTR = "data-a11y";

export function readA11yMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(A11Y_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeA11yMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      localStorage.setItem(A11Y_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(A11Y_STORAGE_KEY);
    }
  } catch {}
}

export function applyA11yMode(enabled: boolean): void {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.setAttribute(A11Y_HTML_ATTR, "true");
  } else {
    document.documentElement.removeAttribute(A11Y_HTML_ATTR);
  }
}
