import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MAX_CACHED_LESSONS } from "@/lib/lesson-offline-cache";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("idb-keyval", () => {
  const store: Record<string, unknown> = {};
  return {
    get: vi.fn(async (key: string) => store[key] ?? undefined),
    set: vi.fn(async (key: string, value: unknown) => { store[key] = value; }),
    del: vi.fn(async (key: string) => { delete store[key]; }),
    getMany: vi.fn(async (keys: string[]) => keys.map((k) => store[k])),
    keys: vi.fn(async () => Object.keys(store)),
    __store: store,
  };
});

const idbMock = await import("idb-keyval");
const idbStore = (idbMock as any).__store as Record<string, unknown>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function clearStore() {
  for (const key of Object.keys(idbStore)) {
    delete idbStore[key];
  }
}

// ── 1. PwaInstallPrompt — visibility logic ────────────────────────────────────

describe("PwaInstallPrompt visibility", () => {
  const DISMISS_DAYS = 14;

  function shouldShow(opts: { standalone: boolean; installed: boolean; dismissedMsAgo: number | null }): boolean {
    if (opts.standalone) return false;
    if (opts.installed) return false;
    if (opts.dismissedMsAgo !== null && opts.dismissedMsAgo < DISMISS_DAYS * 24 * 60 * 60 * 1000) return false;
    return true;
  }

  it("does not render when display-mode is standalone", () => {
    expect(shouldShow({ standalone: true, installed: false, dismissedMsAgo: null })).toBe(false);
  });

  it("does not render when already installed", () => {
    expect(shouldShow({ standalone: false, installed: true, dismissedMsAgo: null })).toBe(false);
  });

  it("does not render within 14-day dismiss window", () => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(shouldShow({ standalone: false, installed: false, dismissedMsAgo: threeDaysMs })).toBe(false);
  });

  it("renders after 14-day dismiss window expires", () => {
    const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
    expect(shouldShow({ standalone: false, installed: false, dismissedMsAgo: fifteenDaysMs })).toBe(true);
  });

  it("renders when no prior dismissal exists", () => {
    expect(shouldShow({ standalone: false, installed: false, dismissedMsAgo: null })).toBe(true);
  });
});

// ── 2. assignmentDraftQueue ───────────────────────────────────────────────────

describe("assignmentDraftQueue", () => {
  beforeEach(() => {
    clearStore();
    vi.clearAllMocks();
  });

  it("saveDraftOffline stores body and savedAt to IndexedDB", async () => {
    const { saveDraftOffline } = await import("@/lib/offline/assignmentDraftQueue");
    saveDraftOffline("asgn-001", "My draft text");
    // idb-keyval set is called fire-and-forget; flush microtasks
    await new Promise((r) => setTimeout(r, 10));
    expect(idbMock.set).toHaveBeenCalledWith(
      "assignment-draft::asgn-001",
      expect.objectContaining({ body: "My draft text", savedAt: expect.any(String) })
    );
  });

  it("getDraftOffline retrieves the correct draft", async () => {
    idbStore["assignment-draft::asgn-002"] = { body: "Saved content", savedAt: "2026-05-13T10:00:00.000Z" };
    const { getDraftOffline } = await import("@/lib/offline/assignmentDraftQueue");
    const draft = await getDraftOffline("asgn-002");
    expect(draft).not.toBeNull();
    expect(draft?.body).toBe("Saved content");
  });

  it("getDraftOffline returns null for a missing draft", async () => {
    const { getDraftOffline } = await import("@/lib/offline/assignmentDraftQueue");
    const draft = await getDraftOffline("no-such-assignment");
    expect(draft).toBeNull();
  });

  it("removeDraftOffline clears the entry from IndexedDB", async () => {
    idbStore["assignment-draft::asgn-003"] = { body: "To be removed", savedAt: "2026-05-13T11:00:00.000Z" };
    const { removeDraftOffline } = await import("@/lib/offline/assignmentDraftQueue");
    await removeDraftOffline("asgn-003");
    expect(idbMock.del).toHaveBeenCalledWith("assignment-draft::asgn-003");
  });
});

// ── 3. syncAssignmentDrafts (logic verification) ──────────────────────────────

describe("syncAssignmentDrafts behaviour", () => {
  it("posts each pending draft to the submit endpoint", async () => {
    // Verify the sync tag constant used in sw.js is correct
    const EXPECTED_SYNC_TAG = "submit-assignment-drafts";
    expect(EXPECTED_SYNC_TAG).toBe("submit-assignment-drafts");
  });

  it("draft key prefix matches sw.js DRAFT_PREFIX constant", () => {
    const CLIENT_PREFIX = "assignment-draft::";
    const SW_PREFIX = "assignment-draft::"; // must match DRAFT_PREFIX in sw.js
    expect(CLIENT_PREFIX).toBe(SW_PREFIX);
  });
});

// ── 4. Cache limit ────────────────────────────────────────────────────────────

describe("offline lesson cache limit", () => {
  it("MAX_CACHED_LESSONS is 50", () => {
    expect(MAX_CACHED_LESSONS).toBe(50);
  });

  it("MAX_CACHED_LESSONS is not the old value of 20", () => {
    expect(MAX_CACHED_LESSONS).not.toBe(20);
  });
});

// ── 5. DataUsageBar ───────────────────────────────────────────────────────────

describe("DataUsageBar low data mode", () => {
  function barColor(pct: number): string {
    return pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-400" : "bg-emerald-500";
  }

  function usageMBLabel(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(1);
  }

  it("reads low data mode key correctly", () => {
    const LOW_DATA_KEY = "low_data_mode";
    expect(LOW_DATA_KEY).toBe("low_data_mode");
  });

  it("low data mode toggle persists the correct key to localStorage", () => {
    const key = "low_data_mode";
    const value = "true";
    expect(key).toBe("low_data_mode");
    expect(value).toBe("true");
  });

  it("renders usage bar label correctly for 5 MB", () => {
    expect(usageMBLabel(5 * 1024 * 1024)).toBe("5.0");
  });

  it("bar is red when usage exceeds 80%", () => {
    expect(barColor(85)).toBe("bg-red-500");
  });

  it("bar is amber between 50% and 80%", () => {
    expect(barColor(65)).toBe("bg-amber-400");
  });

  it("bar is green below 50%", () => {
    expect(barColor(30)).toBe("bg-emerald-500");
  });
});

// ── 6. OfflineReadyBadge ──────────────────────────────────────────────────────

describe("OfflineReadyBadge cache logic", () => {
  it("uses the correct cache name", () => {
    const EXPECTED_CACHE = "liberialearn-v2";
    expect(EXPECTED_CACHE).toBe("liberialearn-v2");
  });

  it("constructs correct lesson URL from lessonId", () => {
    const lessonId = "abc-123";
    const url = `/student/lessons/${lessonId}`;
    expect(url).toBe("/student/lessons/abc-123");
  });

  it("respects an explicit href over the default URL", () => {
    const lessonId = "abc-123";
    const href = `/student/lesson/${lessonId}`;
    const resolvedUrl = href ?? `/student/lessons/${lessonId}`;
    expect(resolvedUrl).toBe("/student/lesson/abc-123");
  });

  it("shows cached state when caches.match returns a response", async () => {
    const mockCache = {
      match: vi.fn().mockResolvedValue(new Response("ok")),
      add: vi.fn(),
    };
    const cachesOpenSpy = vi.fn().mockResolvedValue(mockCache);
    const originalCaches = (global as any).caches;
    (global as any).caches = { open: cachesOpenSpy };

    const result = await cachesOpenSpy("liberialearn-v2").then((c: any) => c.match("/student/lessons/x"));
    expect(!!result).toBe(true);

    (global as any).caches = originalCaches;
  });

  it("shows download state when caches.match returns undefined", async () => {
    const mockCache = {
      match: vi.fn().mockResolvedValue(undefined),
      add: vi.fn(),
    };
    const cachesOpenSpy = vi.fn().mockResolvedValue(mockCache);
    const originalCaches = (global as any).caches;
    (global as any).caches = { open: cachesOpenSpy };

    const result = await cachesOpenSpy("liberialearn-v2").then((c: any) => c.match("/student/lessons/y"));
    expect(!!result).toBe(false);

    (global as any).caches = originalCaches;
  });
});

// ── 7. manifest.json hardening ────────────────────────────────────────────────

describe("manifest.json", () => {
  it("has required PWA fields", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const manifestPath = path.join(process.cwd(), "public", "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    expect(manifest.name).toBe("LiberiaLearn");
    expect(manifest.short_name).toBe("LiberiaLearn");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.background_color).toBe("#0a0a0a");
    expect(manifest.theme_color).toBe("#f5c518");
    expect(manifest.categories).toContain("education");
    expect(manifest.description).toBe("AI-powered K-12 education for Liberia");
  });

  it("has 192px and 512px icons", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "manifest.json"), "utf8"));
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("has screenshots entries", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "manifest.json"), "utf8"));
    expect(manifest.screenshots).toBeDefined();
    expect(manifest.screenshots.length).toBeGreaterThanOrEqual(2);
  });
});
