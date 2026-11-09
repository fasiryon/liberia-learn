// @vitest-environment jsdom
/**
 * Issue #199: the PWA lifecycle and cookie notices are fixed bottom bands. Each publishes its height so globals.css
 * reserves it (scroll-padding and body padding), and the PWA notice stacks above the cookie notice instead of overlapping.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/login" }));

import { CookieNotice, COOKIE_NOTICE_KEY } from "@/components/CookieNotice";
import { PwaLifecycleStatus } from "@/components/PwaLifecycleStatus";

let root: Root | null = null, host: HTMLDivElement | null = null;
const css = (name: string) => document.documentElement.style.getPropertyValue(name);
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no layout: give every band a measurable height.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 64, width: 320, top: 0, left: 0, right: 320, bottom: 64, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
});
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; window.localStorage.clear(); });
function mount(node: React.ReactNode) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  act(() => root!.render(node));
}

describe("fixed notice bands (#199)", () => {
  it("cookie notice is a labelled region that publishes and releases its height", () => {
    mount(<CookieNotice />);
    expect(document.querySelector('[data-cookie-notice][role="region"][aria-label="Cookie notice"]')).not.toBeNull();
    expect(css("--ll-cookie-notice")).toBe("64px");
    act(() => (document.querySelector("[data-cookie-notice] button") as HTMLButtonElement).click());
    expect(window.localStorage.getItem(COOKIE_NOTICE_KEY)).toBe("true");
    expect(css("--ll-cookie-notice")).toBe("");
  });

  it("PWA notice stays visible, reserves its height and stacks above the cookie notice", () => {
    mount(<><CookieNotice /><PwaLifecycleStatus /></>);
    act(() => { window.dispatchEvent(new CustomEvent("liberialearn-pwa-update-available", { detail: {} })); });
    const notice = document.querySelector("[data-pwa-status]") as HTMLElement;
    expect(notice.getAttribute("data-pwa-status")).toBe("update");
    expect(css("--ll-status-notice")).toBe("80px");
    expect(notice.className).toContain("var(--ll-cookie-notice,0px)");
    act(() => (notice.querySelector('button[aria-label="Dismiss this notice"]') as HTMLButtonElement).click());
    expect(document.querySelector("[data-pwa-status]")).toBeNull();
    expect(css("--ll-status-notice")).toBe("");
    // A new lifecycle state shows again after a dismissal.
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(document.querySelector('[data-pwa-status="offline"]')).not.toBeNull();
  });
});
