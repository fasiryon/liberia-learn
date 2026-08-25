import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "crypto";

/**
 * Deliberately does NOT mock "@/lib/content-availability-manifest" — unlike
 * __tests__/lesson.offlineCache.test.ts, which mocks verifyContentAvailabilityManifest
 * to always resolve true so its unrelated cache-mechanics tests aren't coupled to
 * crypto. This file exists specifically to prove the P5-A Phase B rollback/replay
 * defense end-to-end, through the real signing and verification path, at the actual
 * consumption layer a device uses — not just at the contract/crypto layer
 * (see __tests__/trust/p1b-content-manifest.test.ts for that layer's coverage).
 */

const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
}));

vi.mock("@/lib/offline-session", () => ({
  resolveSessionPartition: vi.fn(() => ({ key: "default" })),
  detectAndSetActiveSessionPartition: vi.fn(() => null),
}));

import { cacheLessonContent, loadCachedLesson, refreshLessonAvailability } from "@/lib/lesson-offline-cache";
import { signContentAvailability } from "@/lib/content-availability-manifest.server";

const originalPrivateKey = process.env.CONTENT_MANIFEST_PRIVATE_KEY;
const originalKeyId = process.env.CONTENT_MANIFEST_KEY_ID;
const originalPublicKey = process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY;

describe("P5-A Phase B: real rollback/replay rejection through the actual consumption path (unmocked crypto)", () => {
  beforeEach(() => {
    store.clear();
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    process.env.CONTENT_MANIFEST_PRIVATE_KEY = privateKey;
    process.env.CONTENT_MANIFEST_KEY_ID = "test-key-2026-08";
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY = publicKey;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalPrivateKey === undefined) delete process.env.CONTENT_MANIFEST_PRIVATE_KEY;
    else process.env.CONTENT_MANIFEST_PRIVATE_KEY = originalPrivateKey;
    if (originalKeyId === undefined) delete process.env.CONTENT_MANIFEST_KEY_ID;
    else process.env.CONTENT_MANIFEST_KEY_ID = originalKeyId;
    if (originalPublicKey === undefined) delete process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY;
    else process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY = originalPublicKey;
  });

  it("a captured, still-validly-signed older manifest cannot roll a revoked lesson back to trusted via refreshLessonAvailability", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T00:00:00.000Z"));
    const older = signContentAvailability({ contentId: "content-rollback", version: "1", revoked: false });
    expect(older).not.toBeNull();

    const cached = await cacheLessonContent(
      "content-rollback",
      { metadata: { version: "1" }, payload: { title: "Original lesson" } },
      older
    );
    expect(cached).toBe(true);
    expect(await loadCachedLesson("content-rollback")).not.toBeNull();

    // Real-world: MOE revokes the lesson. A later, genuinely newer manifest arrives on reconnect.
    vi.setSystemTime(new Date("2026-08-25T00:00:00.000Z"));
    const newer = signContentAvailability({ contentId: "content-rollback", version: null, revoked: true });
    expect(newer).not.toBeNull();

    const refreshed = await refreshLessonAvailability(newer!);
    expect(refreshed).toBe(true);
    expect(await loadCachedLesson("content-rollback")).toBeNull(); // correctly evicted

    // Attack: replay the captured `older` manifest — still cryptographically authentic —
    // attempting to roll the device's trust state back to "not revoked".
    const replayAccepted = await refreshLessonAvailability(older!);
    expect(replayAccepted).toBe(false);

    // The revoked state must still hold — the replay must not have silently reinstated trust.
    expect(await loadCachedLesson("content-rollback")).toBeNull();
  });

  it("a captured older manifest cannot be used to re-cache previously-revoked content via cacheLessonContent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T00:00:00.000Z"));
    const older = signContentAvailability({ contentId: "content-recache", version: "1", revoked: false });
    expect(older).not.toBeNull();
    expect(
      await cacheLessonContent(
        "content-recache",
        { metadata: { version: "1" }, payload: { title: "Original lesson" } },
        older
      )
    ).toBe(true);

    vi.setSystemTime(new Date("2026-08-25T00:00:00.000Z"));
    const newer = signContentAvailability({ contentId: "content-recache", version: null, revoked: true });
    expect(await refreshLessonAvailability(newer!)).toBe(true);
    expect(await loadCachedLesson("content-recache")).toBeNull();

    // Attack: attempt to re-cache the lesson using the captured, now-superseded `older` manifest.
    const recacheAccepted = await cacheLessonContent(
      "content-recache",
      { metadata: { version: "1" }, payload: { title: "Original lesson" } },
      older
    );
    expect(recacheAccepted).toBe(false);
    expect(await loadCachedLesson("content-recache")).toBeNull();
  });

  it("a genuinely newer manifest is still accepted and correctly evicts the lesson (no false-positive rollback rejection)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T00:00:00.000Z"));
    const first = signContentAvailability({ contentId: "content-forward", version: "1", revoked: false });
    expect(await cacheLessonContent(
      "content-forward",
      { metadata: { version: "1" }, payload: { title: "v1" } },
      first
    )).toBe(true);

    vi.setSystemTime(new Date("2026-08-25T00:00:00.000Z"));
    const second = signContentAvailability({ contentId: "content-forward", version: "2", revoked: false });
    expect(await refreshLessonAvailability(second!)).toBe(true);
    // version changed 1 -> 2 with no re-cache yet, so the stale body is correctly evicted.
    expect(await loadCachedLesson("content-forward")).toBeNull();
  });
});
