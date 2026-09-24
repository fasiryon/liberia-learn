/**
 * Offline + low-end Android + sync hardening V1 — service worker behavior.
 *
 * Executes the real public/sw.js in a VM with in-memory Cache Storage, a real
 * (fake-indexeddb) IndexedDB, and a scripted network, then drives it through
 * hostile shared-device, connectivity, and sync scenarios.
 */
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";

const SW_SOURCE = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGIN = "https://liberialearn.test";

class FakeCacheStorage {
  stores = new Map<string, Map<string, Response>>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    const store = this.stores.get(name)!;
    return {
      put: async (request: { url: string } | string, response: Response) => {
        const url = typeof request === "string" ? new URL(request, ORIGIN).toString() : request.url;
        store.delete(url);
        store.set(url, response);
      },
      match: async (request: { url: string } | string) => {
        const url = typeof request === "string" ? new URL(request, ORIGIN).toString() : request.url;
        return store.get(url)?.clone();
      },
      keys: async () => [...store.keys()].map((url) => ({ url })),
      delete: async (request: { url: string }) => store.delete(request.url),
      addAll: async (urls: string[]) => {
        for (const url of urls) store.set(new URL(url, ORIGIN).toString(), new Response(`shell:${url}`));
      },
    };
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async match(request: { url: string } | string, options?: { cacheName?: string }) {
    const url = typeof request === "string" ? new URL(request, ORIGIN).toString() : request.url;
    const names = options?.cacheName ? [options.cacheName] : [...this.stores.keys()];
    for (const name of names) {
      const hit = this.stores.get(name)?.get(url);
      if (hit) return hit.clone();
    }
    return undefined;
  }
}

function page(body: string, init: { status?: number; redirected?: boolean } = {}) {
  const response = new Response(body, { status: init.status ?? 200, headers: { "Content-Type": "text/html" } });
  if (init.redirected) Object.defineProperty(response, "redirected", { value: true });
  return response;
}

function json(body: unknown, init: { status?: number; redirected?: boolean } = {}) {
  const response = new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { "Content-Type": "application/json" } });
  if (init.redirected) Object.defineProperty(response, "redirected", { value: true });
  return response;
}

function bootWorker(options: { onSlowTimer?: (fire: () => void) => void } = {}) {
  const handlers = new Map<string, (event: any) => void>();
  const caches = new FakeCacheStorage();
  const indexedDB = new IDBFactory();
  const fetch = vi.fn<(request: any, init?: any) => Promise<Response>>();
  const posted: any[] = [];
  const self = {
    addEventListener: (type: string, handler: (event: any) => void) => handlers.set(type, handler),
    registration: { active: null, showNotification: vi.fn() },
    clients: { matchAll: async () => [{ postMessage: (message: unknown) => posted.push(message) }], claim: vi.fn() },
    skipWaiting: vi.fn(async () => undefined),
    location: { origin: ORIGIN },
  };
  const context = vm.createContext({
    self,
    caches,
    indexedDB,
    fetch,
    crypto: webcrypto,
    console: { warn: () => undefined, log: () => undefined },
    Response,
    URL,
    TextEncoder,
    // The worker's slow-network timer can be driven by the test without
    // faking the timers fake-indexeddb depends on.
    setTimeout: (fn: () => void, ms: number) => (options.onSlowTimer && ms >= 6000 ? (options.onSlowTimer(fn), 0) : setTimeout(fn, ms)),
    clearTimeout,
    Promise,
    Date,
    JSON,
    Math,
    Array,
    Uint8Array,
    clients: self.clients,
  });
  vm.runInContext(SW_SOURCE, context);

  async function dispatch(type: string, event: Record<string, unknown>) {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    handlers.get(type)!({
      ...event,
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
      respondWith: (promise: Promise<Response>) => { responded = promise; },
    });
    await Promise.all(waits);
    return responded;
  }

  const navigate = (pathname: string) => dispatch("fetch", {
    request: { url: `${ORIGIN}${pathname}`, method: "GET", mode: "navigate", destination: "document" },
  });
  const message = (data: Record<string, unknown>) => dispatch("message", { data });

  async function idbPut(key: string, value: unknown) {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("keyval-store");
      open.onupgradeneeded = () => open.result.createObjectStore("keyval");
      open.onsuccess = () => {
        const tx = open.result.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }
  async function idbGet(key: string) {
    return new Promise<any>((resolve, reject) => {
      const open = indexedDB.open("keyval-store");
      open.onupgradeneeded = () => open.result.createObjectStore("keyval");
      open.onsuccess = () => {
        const read = open.result.transaction("keyval", "readonly").objectStore("keyval").get(key);
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      };
      open.onerror = () => reject(open.error);
    });
  }

  const learnerCaches = () => [...caches.stores.keys()].filter((name) => name.includes("-learner-"));

  const install = () => dispatch("install", {});

  return { handlers, caches, indexedDB, fetch, posted, dispatch, install, navigate, message, idbPut, idbGet, learnerCaches };
}

async function bootInstalledWorker(options?: Parameters<typeof bootWorker>[0]) {
  const sw = bootWorker(options);
  await sw.install();
  return sw;
}

const PARTITION_A = "u:learner-a|s:school-1|d:device-1";
const PARTITION_B = "u:learner-b|s:school-1|d:device-1";

function queuedItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    operationId: `op-${id}-0000`,
    idempotencyKey: `op-${id}-0000`,
    protocolVersion: 1,
    learnerId: "learner-a",
    schoolId: "school-1",
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
    ...overrides,
  };
}

describe("service worker hardening V1 — shared-device privacy", () => {
  it("never serves one learner's cached page to the next learner on the same device", async () => {
    const sw = await bootInstalledWorker();
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
    sw.fetch.mockResolvedValueOnce(page("learner A private dashboard"));
    const online = await sw.navigate("/student/today");
    expect(await online!.text()).toBe("learner A private dashboard");
    expect(sw.learnerCaches()).toHaveLength(1);

    // Learner B signs in on the shared phone, then the network drops.
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_B });
    expect(sw.learnerCaches()).toHaveLength(0);
    sw.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const offline = await sw.navigate("/student/today");
    const body = await offline!.text();
    expect(body).not.toContain("learner A");
    expect(body).toBe("shell:/offline");
  });

  it("clears every learner page cache on logout", async () => {
    const sw = await bootInstalledWorker();
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
    sw.fetch.mockResolvedValue(page("private"));
    await sw.navigate("/student/grades");
    expect(sw.learnerCaches()).toHaveLength(1);
    await sw.message({ type: "CLEAR_LEARNER_CACHES" });
    expect(sw.learnerCaches()).toHaveLength(0);
  });

  it("reaching the sign-in page unbinds the learner before anyone else signs in", async () => {
    const sw = await bootInstalledWorker();
    await sw.idbPut("liberialearn_active_partition", { key: PARTITION_A });
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
    sw.fetch.mockResolvedValueOnce(page("learner A page"));
    await sw.navigate("/student/today");
    expect(sw.learnerCaches()).toHaveLength(1);
    await sw.navigate("/login");
    expect(sw.learnerCaches()).toHaveLength(0);
    expect(await sw.idbGet("liberialearn_active_partition")).toBeUndefined();
    // The next learner's first page is not written into anyone's cache.
    sw.fetch.mockResolvedValueOnce(page("learner B page"));
    await sw.navigate("/student/today");
    expect(sw.learnerCaches()).toHaveLength(0);
  });

  it("does not cache learner pages when no learner is bound (network only)", async () => {
    const sw = await bootInstalledWorker();
    sw.fetch.mockResolvedValueOnce(page("someone's page"));
    await sw.navigate("/student/today");
    expect(sw.learnerCaches()).toHaveLength(0);
    sw.fetch.mockRejectedValueOnce(new TypeError("offline"));
    const offline = await sw.navigate("/student/today");
    expect(await offline!.text()).toBe("shell:/offline");
  });

  it("never stores a redirect (expired session, forced PIN change) as the learner page", async () => {
    const sw = await bootInstalledWorker();
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
    sw.fetch.mockResolvedValueOnce(page("login form", { redirected: true }));
    await sw.navigate("/student/today");
    sw.fetch.mockResolvedValueOnce(page("server error", { status: 500 }));
    await sw.navigate("/student/today");
    const cacheName = sw.learnerCaches()[0];
    expect(cacheName ? sw.caches.stores.get(cacheName)!.size : 0).toBe(0);
  });

  it("reads the bound learner from IndexedDB after the worker is restarted", async () => {
    const sw = await bootInstalledWorker();
    await sw.idbPut("liberialearn_active_partition", { key: PARTITION_A });
    sw.fetch.mockResolvedValueOnce(page("learner A lesson"));
    await sw.navigate("/student/lessons/lesson-1");
    sw.fetch.mockRejectedValueOnce(new TypeError("offline"));
    const offline = await sw.navigate("/student/lessons/lesson-1");
    expect(await offline!.text()).toBe("learner A lesson");
  });
});

describe("service worker hardening V1 — bounded caches and updates", () => {
  it("caps the learner page cache so low-storage devices do not fill up", async () => {
    const sw = await bootInstalledWorker();
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
    sw.fetch.mockImplementation(async () => page("lesson"));
    for (let index = 0; index < 75; index++) await sw.navigate(`/student/lessons/l-${index}`);
    const size = sw.caches.stores.get(sw.learnerCaches()[0])!.size;
    expect(size).toBe(60);
  });

  it("an update removes old-version caches (including P5-C shared page caches) but not the current learner cache", async () => {
    const sw = await bootInstalledWorker();
    await sw.caches.open("liberialearn-shell-p5c-2026-08-27-1");
    await sw.caches.open("liberialearn-learner-p5d-old-abc");
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
    sw.fetch.mockResolvedValueOnce(page("current"));
    await sw.navigate("/student/today");
    const current = sw.learnerCaches().filter((name) => !name.includes("p5d-old"));
    await sw.dispatch("activate", {});
    const names = [...sw.caches.stores.keys()];
    expect(names).not.toContain("liberialearn-shell-p5c-2026-08-27-1");
    expect(names).not.toContain("liberialearn-learner-p5d-old-abc");
    expect(names).toEqual(expect.arrayContaining(current));
  });

  it("serves the learner's cached lesson on a very slow network instead of hanging", async () => {
    const slowTimers: Array<() => void> = [];
    const sw = await bootInstalledWorker({ onSlowTimer: (fire) => slowTimers.push(fire) });
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
    sw.fetch.mockResolvedValueOnce(page("cached lesson"));
    await sw.navigate("/student/lessons/l-1");
    // The next request never completes (stalled 2G connection).
    sw.fetch.mockImplementationOnce(() => new Promise(() => undefined));
    const pending = sw.navigate("/student/lessons/l-1");
    while (slowTimers.length === 0) await new Promise((resolve) => setTimeout(resolve, 5));
    slowTimers.forEach((fire) => fire());
    const response = (await pending)!;
    expect(await response.text()).toBe("cached lesson");
  });
});

describe("service worker hardening V1 — outbox replay", () => {
  async function seed(sw: ReturnType<typeof bootWorker>) {
    await sw.idbPut(`liberialearn_offline_queue::${PARTITION_A}`, [queuedItem("a1")]);
    await sw.idbPut(`liberialearn_offline_queue::${PARTITION_B}`, [queuedItem("b1", { learnerId: "learner-b" })]);
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
  }

  it("replays only the signed-in learner's partition", async () => {
    const sw = await bootInstalledWorker();
    await seed(sw);
    sw.fetch.mockResolvedValue(json({ results: [{ status: "synced" }] }));
    await sw.message({ type: "SYNC_NOW" });
    expect(sw.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sw.fetch.mock.calls[0][1].body).items[0].operationId).toBe("op-a1-0000");
    expect(await sw.idbGet(`liberialearn_offline_queue::${PARTITION_A}`)).toBeUndefined();
    expect(await sw.idbGet(`liberialearn_offline_queue::${PARTITION_B}`)).toHaveLength(1);
  });

  it("does not replay anything when no learner is bound", async () => {
    const sw = await bootInstalledWorker();
    await sw.idbPut(`liberialearn_offline_queue::${PARTITION_A}`, [queuedItem("a1")]);
    await sw.message({ type: "SYNC_NOW" });
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it("keeps work when a 200 response has no per-operation verdict", async () => {
    const sw = await bootInstalledWorker();
    await seed(sw);
    sw.fetch.mockResolvedValue(json({}));
    await sw.message({ type: "SYNC_NOW" });
    const [item] = await sw.idbGet(`liberialearn_offline_queue::${PARTITION_A}`);
    expect(item.lastError).toBe("sync_response_unrecognized");
    expect(item.status).toBe("pending");
  });

  it("holds work for sign-in when the session expired or the request was redirected", async () => {
    const sw = await bootInstalledWorker();
    await seed(sw);
    sw.fetch.mockResolvedValue(page("<html>change your PIN</html>", { redirected: true }));
    await sw.message({ type: "SYNC_NOW" });
    const [item] = await sw.idbGet(`liberialearn_offline_queue::${PARTITION_A}`);
    expect(item.syncState).toBe("AUTH_REQUIRED");
    expect(item.attempts).toBe(0);
  });

  it("network flapping never quarantines learner work", async () => {
    const sw = await bootInstalledWorker();
    await seed(sw);
    sw.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    for (let index = 0; index < 6; index++) await sw.message({ type: "SYNC_NOW" });
    const [item] = await sw.idbGet(`liberialearn_offline_queue::${PARTITION_A}`);
    expect(item.status).toBe("pending");
    expect(item.syncState).toBe("RETRYABLE_FAILURE");
    expect(item.attempts).toBe(0);
    expect(item.networkDeferrals).toBe(6);
  });

  it("treats a replay-deduplicated verdict as acknowledged (lost response, then retry)", async () => {
    const sw = await bootInstalledWorker();
    await seed(sw);
    sw.fetch.mockResolvedValue(json({ results: [{ status: "rejected", resolutionHint: "replay_deduped" }] }));
    await sw.message({ type: "SYNC_NOW" });
    expect(await sw.idbGet(`liberialearn_offline_queue::${PARTITION_A}`)).toBeUndefined();
  });

  it("creates the idb-keyval object store when the worker opens the database first", async () => {
    const sw = await bootInstalledWorker();
    await sw.message({ type: "SET_ACTIVE_PARTITION", key: PARTITION_A });
    await sw.message({ type: "SYNC_NOW" });
    // A later idb-keyval open (no version, no upgrade) must find the store.
    const stores = await new Promise<string[]>((resolve) => {
      const open = sw.indexedDB.open("keyval-store");
      open.onsuccess = () => resolve([...open.result.objectStoreNames]);
    });
    expect(stores).toContain("keyval");
  });
});
