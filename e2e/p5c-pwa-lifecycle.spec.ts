import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";

const SHELL_CACHE_PREFIX = "liberialearn-shell-";

async function waitForServiceWorker(page: Page) {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const registration = (await navigator.serviceWorker.getRegistrations()).find(
        (candidate) => candidate.active?.state === "activated",
      );
      if (registration) return { active: registration.active?.state ?? null, scope: registration.scope };
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    throw new Error("Service worker did not activate within 15 seconds");
  });
}

async function putDurableOutboxMarker(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("keyval-store", 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("keyval")) request.result.createObjectStore("keyval");
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("keyval", "readwrite");
        transaction.objectStore("keyval").put(
          [{ operationId: "p5c-browser-operation", syncState: "LOCAL_PENDING" }],
          "liberialearn_offline_queue::p5c-browser-partition",
        );
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
}

async function readDurableOutboxMarker(page: Page) {
  return page.evaluate(async () => await new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open("keyval-store", 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("keyval")) request.result.createObjectStore("keyval");
    };
    request.onsuccess = () => {
      const transaction = request.result.transaction("keyval", "readonly");
      const read = transaction.objectStore("keyval").get("liberialearn_offline_queue::p5c-browser-partition");
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    };
  }));
}

async function assertOfflineShell(page: Page, context: BrowserContext, heading = "You are offline.") {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");
  await context.setOffline(false);
}

test.describe("P5-C real browser PWA lifecycle", () => {
  test("manifest, service worker, shell cache, and offline launch are real browser behavior", async ({ page, context }) => {
    await page.goto("/offline", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    });
    const manifestResponse = await page.request.get("/manifest.json");
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBe("LiberiaLearn");
    expect(manifest.short_name).toBe("LiberiaLearn");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons.filter((entry: { sizes?: string }) => ["192x192", "512x512"].includes(entry.sizes ?? ""))) {
      expect((await page.request.get(icon.src)).ok()).toBe(true);
    }

    const worker = await waitForServiceWorker(page);
    expect(worker?.active).toBe("activated");
    expect(worker?.scope).toBe(new URL("/", page.url()).toString());

    const cacheState = await page.evaluate(async (prefix) => {
      const names = await caches.keys();
      const shell = names.find((name) => name.startsWith(prefix));
      const cachedOffline = shell ? Boolean(await caches.open(shell).then((cache) => cache.match("/offline.html"))) : false;
      return { names, shell, cachedOffline };
    }, SHELL_CACHE_PREFIX);
    expect(cacheState.shell).toBeTruthy();
    expect(cacheState.cachedOffline).toBe(true);

    await assertOfflineShell(page, context);
  });

  test("IndexedDB outbox and Cache Storage survive a browser-context restart", async ({ isMobile }, testInfo) => {
    const profile = join(tmpdir(), `liberialearn-p5c-profile-${process.pid}-${testInfo.testId}-${Date.now()}`);
    const viewport = isMobile ? { width: 393, height: 852 } : { width: 1280, height: 800 };
    const offlineUrl = new URL("/offline.html", process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100").toString();
    const persistentCacheName = "p5c-persistent-cache";
    const persistentCachePath = "/p5c-persistent-marker";
    const first = await chromium.launchPersistentContext(profile, { headless: true, viewport });
    const firstPage = await first.newPage();
    await firstPage.goto(offlineUrl, { waitUntil: "load" });
    await putDurableOutboxMarker(firstPage);
    await firstPage.evaluate(async ({ cacheName, path }) => {
      await caches.open(cacheName).then((cache) => cache.put(path, new Response("preserved")));
    }, { cacheName: persistentCacheName, path: persistentCachePath });
    await first.close();

    const second = await chromium.launchPersistentContext(profile, { headless: true, viewport });
    const secondPage = await second.newPage();
    await secondPage.goto(offlineUrl, { waitUntil: "load" });
    expect(await readDurableOutboxMarker(secondPage)).toEqual([
      { operationId: "p5c-browser-operation", syncState: "LOCAL_PENDING" },
    ]);
    const cachedMarker = await secondPage.evaluate(async ({ cacheName, path }) => {
      const response = await (await caches.open(cacheName)).match(path);
      return response?.text() ?? null;
    }, { cacheName: persistentCacheName, path: persistentCachePath });
    expect(cachedMarker).toBe("preserved");
    await second.close();
  });
});
