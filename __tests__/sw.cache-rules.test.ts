import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const swPath = path.join(process.cwd(), "public", "sw.js");
const offlinePath = path.join(process.cwd(), "public", "offline.html");

describe("service worker cache rules", () => {
  it("ships an offline fallback page", () => {
    const html = fs.readFileSync(offlinePath, "utf8");
    expect(html).toContain("LiberiaLearn");
    expect(html).toContain("You're offline.");
    expect(html).toContain("window.location.reload()");
  });

  it("bypasses protected and api routes", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain('pathname.startsWith("/api/")');
    expect(sw).toContain('pathname === "/login"');
    expect(sw).toContain('pathname === "/guardian/login"');
    expect(sw).toContain('pathname.startsWith("/teacher")');
    expect(sw).toContain('pathname.startsWith("/admin")');
    expect(sw).toContain('pathname.startsWith("/platform")');
    expect(sw).toContain('pathname.startsWith("/moe")');
  });

  it("caches static assets and lesson pages conservatively", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain('"/offline.html"');
    expect(sw).toContain('url.pathname.startsWith("/_next/static/")');
    expect(sw).toContain("isLessonPage(url.pathname)");
    expect(sw).toContain("staleWhileRevalidate(event.request)");
    expect(sw).toContain('await caches.match("/offline.html")');
  });
});
