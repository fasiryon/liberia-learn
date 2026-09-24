import { expect, test, type Page } from "@playwright/test";

/**
 * Offline + low-end Android + sync hardening V1 — real browser coverage.
 *
 * Runs against the production build with the real service worker, Cache
 * Storage, and IndexedDB. No database session exists in CI, so every sync
 * attempt meets a genuinely expired/absent session.
 */

const PARTITION_A = "u:e2e-learner-a|s:e2e-school|d:e2e-device";
const PARTITION_B = "u:e2e-learner-b|s:e2e-school|d:e2e-device";

async function controlledPage(page: Page) {
  await page.goto("/offline", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
}

async function idb(page: Page, action: "put" | "get", key: string, value?: unknown) {
  return page.evaluate(async ({ action, key, value }) => new Promise<unknown>((resolve, reject) => {
    const open = indexedDB.open("keyval-store");
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("keyval")) open.result.createObjectStore("keyval");
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("keyval", action === "put" ? "readwrite" : "readonly");
      const store = tx.objectStore("keyval");
      const request = action === "put" ? store.put(value, key) : store.get(key);
      tx.oncomplete = () => resolve(action === "get" ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
    };
  }), { action, key, value });
}

async function postToWorker(page: Page, message: Record<string, unknown>, waitFor?: string) {
  return page.evaluate(async ({ message, waitFor }) => new Promise<unknown>((resolve) => {
    if (waitFor) {
      const timer = setTimeout(() => resolve(null), 10_000);
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === waitFor) {
          clearTimeout(timer);
          resolve(event.data);
        }
      });
    }
    navigator.serviceWorker.controller!.postMessage(message);
    if (!waitFor) setTimeout(() => resolve(null), 300);
  }), { message, waitFor });
}

function queuedOperation(id: string, learnerId: string) {
  return {
    id,
    operationId: `e2e-op-${id}`,
    idempotencyKey: `e2e-op-${id}`,
    protocolVersion: 1,
    learnerId,
    schoolId: "e2e-school",
    resourceType: "lesson_progress",
    resourceId: `sw-${id}`,
    operationType: "progress.complete",
    payload: { scheduledWorkId: `sw-${id}` },
    clientCreatedAt: "2026-09-23T10:00:00.000Z",
    dependencyIds: [],
    status: "pending",
    syncState: "LOCAL_PENDING",
    attempts: 0,
    retryCount: 0,
    nextRetryAt: null,
    createdAt: "2026-09-23T10:00:00.000Z",
    updatedAt: "2026-09-23T10:00:00.000Z",
  };
}

test.describe("P5-E offline hardening in a real browser", () => {
  test("a login redirect is never cached as a learner page and offline launch shows the offline shell", async ({ page, context }) => {
    await controlledPage(page);
    await postToWorker(page, { type: "SET_ACTIVE_PARTITION", key: PARTITION_A });

    // No session in CI: the learner route redirects to /login.
    await page.goto("/student/today", { waitUntil: "domcontentloaded" });
    const cachedLearnerEntries = await page.evaluate(async () => {
      let entries = 0;
      for (const name of await caches.keys()) {
        if (name.includes("-learner-")) entries += (await (await caches.open(name)).keys()).length;
      }
      return entries;
    });
    expect(cachedLearnerEntries).toBe(0);

    await context.setOffline(true);
    await page.goto("/student/today", { waitUntil: "domcontentloaded" }).catch(() => null);
    await expect(page.getByRole("heading", { name: "You are offline." })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
    await context.setOffline(false);
  });

  test("switching learners on a shared device deletes the previous learner's page cache", async ({ page }) => {
    await controlledPage(page);
    await postToWorker(page, { type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
    // Simulate learner A's private page cache left by an earlier session.
    const learnerCache = await page.evaluate(async () => {
      const name = "liberialearn-learner-planted-for-learner-a";
      await (await caches.open(name)).put("/student/grades", new Response("learner A grades"));
      return name;
    });
    await postToWorker(page, { type: "SET_ACTIVE_PARTITION", key: PARTITION_B });
    const names = await page.evaluate(async () => caches.keys());
    expect(names).not.toContain(learnerCache);

    await postToWorker(page, { type: "CLEAR_LEARNER_CACHES" });
    expect((await page.evaluate(async () => caches.keys())).some((name) => name.includes("-learner-"))).toBe(false);
  });

  test("queued work replays only for the bound learner and is held, not lost, when auth has expired", async ({ page }) => {
    await controlledPage(page);
    await idb(page, "put", `liberialearn_offline_queue::${PARTITION_A}`, [queuedOperation("a1", "e2e-learner-a")]);
    await idb(page, "put", `liberialearn_offline_queue::${PARTITION_B}`, [queuedOperation("b1", "e2e-learner-b")]);
    await idb(page, "put", "liberialearn_active_partition", { key: PARTITION_A });
    await postToWorker(page, { type: "SET_ACTIVE_PARTITION", key: PARTITION_A });

    const done = await postToWorker(page, { type: "SYNC_NOW" }, "offline-sync-complete");
    expect(done).toMatchObject({ syncedCount: 0 });

    const [learnerA] = (await idb(page, "get", `liberialearn_offline_queue::${PARTITION_A}`)) as Array<Record<string, unknown>>;
    expect(learnerA.syncState).toBe("AUTH_REQUIRED");
    expect(learnerA.attempts).toBe(0);
    const [learnerB] = (await idb(page, "get", `liberialearn_offline_queue::${PARTITION_B}`)) as Array<Record<string, unknown>>;
    expect(learnerB.syncState).toBe("LOCAL_PENDING");
    expect(learnerB.updatedAt).toBe("2026-09-23T10:00:00.000Z");
  });

  test("queued work survives a service-worker update", async ({ page }) => {
    await controlledPage(page);
    await idb(page, "put", `liberialearn_offline_queue::${PARTITION_A}`, [queuedOperation("a1", "e2e-learner-a")]);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
      registration?.waiting?.postMessage({ type: "ACTIVATE_UPDATE" });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const queue = (await idb(page, "get", `liberialearn_offline_queue::${PARTITION_A}`)) as unknown[];
    expect(queue).toHaveLength(1);
  });

  test("constrained-device measurement: offline shell cold and cached launch", async ({ page, context, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "CDP throttling is Chromium-only");
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    // Budget Android handset on a weak 3G link.
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 400,
      downloadThroughput: Math.round((400 * 1024) / 8),
      uploadThroughput: Math.round((400 * 1024) / 8),
    });

    const cold = Date.now();
    await page.goto("/offline", { waitUntil: "load" });
    const coldMs = Date.now() - cold;
    const coldBytes = await page.evaluate(() =>
      performance.getEntriesByType("resource").reduce((sum, entry) => sum + ((entry as PerformanceResourceTiming).transferSize || 0), 0) +
      ((performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.transferSize ?? 0),
    );
    const jsBytes = await page.evaluate(() =>
      performance.getEntriesByType("resource")
        .filter((entry) => entry.name.endsWith(".js"))
        .reduce((sum, entry) => sum + ((entry as PerformanceResourceTiming).encodedBodySize || 0), 0),
    );

    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      await navigator.serviceWorker.ready;
    });
    await page.reload({ waitUntil: "load" });
    await context.setOffline(true);
    const warm = Date.now();
    await page.reload({ waitUntil: "load" });
    const offlineLaunchMs = Date.now() - warm;
    await expect(page.getByRole("heading", { name: "You are offline." })).toBeVisible();
    await context.setOffline(false);

    const measurement = { project: testInfo.project.name, coldMs, coldBytes, jsBytes, offlineLaunchMs };
    console.log(`[p5e-measurement] ${JSON.stringify(measurement)}`);
    await testInfo.attach("p5e-measurement.json", { body: JSON.stringify(measurement, null, 2), contentType: "application/json" });
    // Offline launch is served from Cache Storage; it must not depend on the
    // network and should stay fast even with a 4x slower CPU.
    expect(offlineLaunchMs).toBeLessThan(5000);
  });
});
