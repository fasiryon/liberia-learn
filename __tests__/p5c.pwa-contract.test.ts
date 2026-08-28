import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "public/manifest.json"), "utf8"));
const serviceWorker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

describe("P5-C PWA lifecycle contract", () => {
  it("has install metadata and the required icon sizes", () => {
    expect(manifest.name).toBe("LiberiaLearn");
    expect(manifest.short_name).toBe("LiberiaLearn");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  it("keeps shell, runtime, and content cache lifecycles separate", () => {
    expect(serviceWorker).toContain("SHELL_CACHE");
    expect(serviceWorker).toContain("RUNTIME_CACHE");
    expect(serviceWorker).toContain("CONTENT_CACHE");
    expect(serviceWorker).toContain("ACTIVATE_UPDATE");
    expect(serviceWorker).toContain("retryOrDeadLetter");
    expect(serviceWorker).not.toContain('const CACHE_NAME = "liberialearn-v2"');
  });
});
