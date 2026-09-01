import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSign, generateKeyPairSync } from "crypto";

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
  update: vi.fn(async (key: string, updater: (value: unknown) => unknown) => {
    store.set(key, updater(store.get(key)));
  }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
}));

vi.mock("@/lib/offline-session", () => ({
  resolveSessionPartition: vi.fn(() => ({ key: "default" })),
  detectAndSetActiveSessionPartition: vi.fn(() => null),
}));

import {
  cacheLessonContent,
  loadCachedLesson,
  refreshLessonAvailability,
  removeCachedLesson,
} from "@/lib/lesson-offline-cache";
import {
  configureCacheLifecycle,
  purgeExpiredPacks,
  purgePartitionPacks,
} from "@/lib/offline-cache";
import {
  hashContentAvailabilityData,
  signContentAvailability,
} from "@/lib/content-availability-manifest.server";
import {
  serializeContentAvailability,
  type ContentAvailabilityPayload,
  type ContentAvailabilitySequence,
  type SignedContentAvailabilityManifest,
} from "@/lib/content-availability-manifest";

const originalPrivateKey = process.env.CONTENT_MANIFEST_PRIVATE_KEY;
const originalKeyId = process.env.CONTENT_MANIFEST_KEY_ID;
const originalPublicKey = process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY;

function signManifest(input: {
  contentId: string;
  version: string | null;
  revoked: boolean;
  sequence: ContentAvailabilitySequence;
  issuedAt?: string;
}) {
  const titleByContentId: Record<string, string> = {
    "content-rollback": "Original lesson",
    "content-recache": "Original lesson",
    "content-forward": "v1",
    "content-transition": "sequenced",
    "content-no-downgrade": "current",
    "content-idempotent": "same",
    "content-conflict": "trusted",
    "content-first-cache": "available offline",
  };
  const hash = input.version
    ? hashContentAvailabilityData({
        contentId: input.contentId,
        version: input.version,
        metadata: { version: input.version },
        payload: { title: titleByContentId[input.contentId] ?? "test" },
      })
    : null;
  return signContentAvailability({
    ...input,
    issuedAt: input.issuedAt ??
      `2026-08-25T00:00:${String(input.sequence.revision + input.sequence.governance).padStart(2, "0")}.000Z`,
    expiresAt: "2026-09-01T00:00:00.000Z",
    minClientVersion: "1.0.0",
    contents: input.revoked ? [] : [{
      contentId: input.contentId,
      version: input.version!,
      sha256: hash!,
    }],
  });
}

function signLegacyManifest(input: {
  contentId: string;
  version: string | null;
  revoked: boolean;
}): SignedContentAvailabilityManifest {
  const payload: ContentAvailabilityPayload = {
    ...input,
    issuedAt: "2026-08-01T00:00:00.000Z",
  };
  const signer = createSign("RSA-SHA256");
  signer.update(serializeContentAvailability(payload));
  signer.end();
  return {
    payload,
    signature: signer.sign(process.env.CONTENT_MANIFEST_PRIVATE_KEY!, "base64"),
    keyId: process.env.CONTENT_MANIFEST_KEY_ID!,
  };
}

describe("P5-A Phase B: real rollback/replay rejection through the actual consumption path (unmocked crypto)", () => {
  beforeEach(() => {
    store.clear();
    // The test manifests are intentionally valid at this fixed instant. Keep
    // rollback coverage independent of the date on which CI happens to run.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
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
    configureCacheLifecycle({
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      maxStorageBytes: 25 * 1024 * 1024,
    });
    if (originalPrivateKey === undefined) delete process.env.CONTENT_MANIFEST_PRIVATE_KEY;
    else process.env.CONTENT_MANIFEST_PRIVATE_KEY = originalPrivateKey;
    if (originalKeyId === undefined) delete process.env.CONTENT_MANIFEST_KEY_ID;
    else process.env.CONTENT_MANIFEST_KEY_ID = originalKeyId;
    if (originalPublicKey === undefined) delete process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY;
    else process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY = originalPublicKey;
  });

  it("a captured, still-validly-signed older manifest cannot roll a revoked lesson back to trusted via refreshLessonAvailability", async () => {
    const older = signManifest({
      contentId: "content-rollback",
      version: "1",
      revoked: false,
      sequence: { revision: 1, governance: 1 },
    });
    expect(older).not.toBeNull();

    const cached = await cacheLessonContent(
      "content-rollback",
      { metadata: { version: "1" }, payload: { title: "Original lesson" } },
      older
    );
    expect(cached).toBe(true);
    expect(await loadCachedLesson("content-rollback")).not.toBeNull();

    // Real-world: MOE revokes the lesson. A later, genuinely newer manifest arrives on reconnect.
    const newer = signManifest({
      contentId: "content-rollback",
      version: null,
      revoked: true,
      sequence: { revision: 1, governance: 2 },
    });
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
    const older = signManifest({
      contentId: "content-recache",
      version: "1",
      revoked: false,
      sequence: { revision: 1, governance: 1 },
    });
    expect(older).not.toBeNull();
    expect(
      await cacheLessonContent(
        "content-recache",
        { metadata: { version: "1" }, payload: { title: "Original lesson" } },
        older
      )
    ).toBe(true);

    const newer = signManifest({
      contentId: "content-recache",
      version: null,
      revoked: true,
      sequence: { revision: 1, governance: 2 },
    });
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

  it("rejects a stale lesson response before it can overwrite a newer cached body", async () => {
    const older = signManifest({
      contentId: "content-stale-cache",
      version: "1",
      revoked: false,
      sequence: { revision: 1, governance: 1 },
    });
    const newer = signManifest({
      contentId: "content-stale-cache",
      version: "2",
      revoked: false,
      sequence: { revision: 2, governance: 1 },
    });
    expect(await cacheLessonContent(
      "content-stale-cache",
      { metadata: { version: "1" }, payload: { title: "test" } },
      older,
    )).toBe(true);
    expect(await cacheLessonContent(
      "content-stale-cache",
      { metadata: { version: "2" }, payload: { title: "test" } },
      newer,
    )).toBe(true);

    expect(await cacheLessonContent(
      "content-stale-cache",
      { metadata: { version: "1" }, payload: { title: "test" } },
      older,
    )).toBe(false);
    expect((await loadCachedLesson("content-stale-cache"))?.metadata?.version).toBe("2");
  });

  it("a genuinely newer manifest is still accepted and correctly evicts the lesson (no false-positive rollback rejection)", async () => {
    const first = signManifest({
      contentId: "content-forward",
      version: "1",
      revoked: false,
      sequence: { revision: 1, governance: 1 },
    });
    expect(await cacheLessonContent(
      "content-forward",
      { metadata: { version: "1" }, payload: { title: "v1" } },
      first
    )).toBe(true);

    const second = signManifest({
      contentId: "content-forward",
      version: "2",
      revoked: false,
      sequence: { revision: 2, governance: 1 },
    });
    expect(await refreshLessonAvailability(second!)).toBe(true);
    // version changed 1 -> 2 with no re-cache yet, so the stale body is correctly evicted.
    expect(await loadCachedLesson("content-forward")).toBeNull();
  });

  it("establishes a sequenced baseline over a stored pre-Phase-B manifest", async () => {
    const legacy = signLegacyManifest({
      contentId: "content-transition",
      version: "1",
      revoked: false,
    });
    expect(await cacheLessonContent(
      "content-transition",
      { metadata: { version: "1" }, payload: { title: "legacy" } },
      legacy,
    )).toBe(true);

    const sequenced = signManifest({
      contentId: "content-transition",
      version: "2",
      revoked: false,
      sequence: { revision: 2, governance: 4 },
    });
    expect(await cacheLessonContent(
      "content-transition",
      { metadata: { version: "2" }, payload: { title: "sequenced" } },
      sequenced,
    )).toBe(true);
    expect((await loadCachedLesson("content-transition"))?.payload?.title).toBe("sequenced");

    expect(await refreshLessonAvailability(legacy)).toBe(false);
    expect((await loadCachedLesson("content-transition"))?.payload?.title).toBe("sequenced");
  });

  it("uses the first stored legacy manifest as a compatibility marker", async () => {
    const first = signLegacyManifest({
      contentId: "content-legacy-marker",
      version: "1",
      revoked: false,
    });
    expect(await cacheLessonContent(
      "content-legacy-marker",
      { metadata: { version: "1" }, payload: { title: "first" } },
      first,
    )).toBe(true);
    expect(await refreshLessonAvailability(first)).toBe(true);

    const conflicting = signLegacyManifest({
      contentId: "content-legacy-marker",
      version: null,
      revoked: true,
    });
    expect(await refreshLessonAvailability(conflicting)).toBe(false);
    expect((await loadCachedLesson("content-legacy-marker"))?.payload?.title).toBe("first");
  });

  it("rejects an unsequenced incoming manifest after a sequenced baseline", async () => {
    const current = signManifest({
      contentId: "content-no-downgrade",
      version: "2",
      revoked: false,
      sequence: { revision: 2, governance: 3 },
    });
    expect(await cacheLessonContent(
      "content-no-downgrade",
      { metadata: { version: "2" }, payload: { title: "current" } },
      current,
    )).toBe(true);

    const legacy = signLegacyManifest({
      contentId: "content-no-downgrade",
      version: "1",
      revoked: false,
    });
    expect(await refreshLessonAvailability(legacy)).toBe(false);
    expect((await loadCachedLesson("content-no-downgrade"))?.payload?.title).toBe("current");
  });

  it("accepts an identical same-sequence manifest idempotently", async () => {
    const manifest = signManifest({
      contentId: "content-idempotent",
      version: "1",
      revoked: false,
      sequence: { revision: 4, governance: 7 },
    });
    expect(await cacheLessonContent(
      "content-idempotent",
      { metadata: { version: "1" }, payload: { title: "same" } },
      manifest,
    )).toBe(true);
    expect(await refreshLessonAvailability(manifest!)).toBe(true);
    expect((await loadCachedLesson("content-idempotent"))?.payload?.title).toBe("same");
  });

  it("rejects a conflicting valid signature at the same sequence", async () => {
    const current = signManifest({
      contentId: "content-conflict",
      version: "1",
      revoked: false,
      sequence: { revision: 4, governance: 7 },
      issuedAt: "2026-08-25T10:00:00.000Z",
    });
    expect(await cacheLessonContent(
      "content-conflict",
      { metadata: { version: "1" }, payload: { title: "trusted" } },
      current,
    )).toBe(true);

    const conflicting = signManifest({
      contentId: "content-conflict",
      version: null,
      revoked: true,
      sequence: { revision: 4, governance: 7 },
      issuedAt: "2026-08-25T10:00:00.000Z",
    });
    expect(await refreshLessonAvailability(conflicting!)).toBe(false);
    expect((await loadCachedLesson("content-conflict"))?.payload?.title).toBe("trusted");
  });

  it("orders crossed cursors by revision first, then governance within that revision", async () => {
    const current = signManifest({
      contentId: "content-crossed",
      version: "2",
      revoked: false,
      sequence: { revision: 5, governance: 9 },
    });
    expect(await refreshLessonAvailability(current!)).toBe(true);

    const newerRevision = signManifest({
      contentId: "content-crossed",
      version: "3",
      revoked: false,
      sequence: { revision: 6, governance: 0 },
    });
    expect(await refreshLessonAvailability(newerRevision!)).toBe(true);

    const olderRevision = signManifest({
      contentId: "content-crossed",
      version: "2",
      revoked: false,
      sequence: { revision: 5, governance: 100 },
    });
    expect(await refreshLessonAvailability(olderRevision!)).toBe(false);
  });

  it("accepts a governance-only advance when revision stays the same", async () => {
    const first = signManifest({
      contentId: "content-governance-advance",
      version: "1",
      revoked: false,
      sequence: { revision: 3, governance: 5 },
    });
    expect(await refreshLessonAvailability(first!)).toBe(true);

    const approved = signManifest({
      contentId: "content-governance-advance",
      version: "1",
      revoked: false,
      sequence: { revision: 3, governance: 6 },
    });
    expect(await refreshLessonAvailability(approved!)).toBe(true);

    // Replaying the pre-approval governance state at the same revision must
    // still be rejected as stale.
    expect(await refreshLessonAvailability(first!)).toBe(false);
  });

  it("preserves ordinary first-time cache behavior with a governed sequence", async () => {
    const first = signManifest({
      contentId: "content-first-cache",
      version: "1",
      revoked: false,
      sequence: { revision: 1, governance: 0 },
    });
    expect(await cacheLessonContent(
      "content-first-cache",
      { metadata: { version: "1" }, payload: { title: "available offline" } },
      first,
    )).toBe(true);
    expect((await loadCachedLesson("content-first-cache"))?.payload?.title).toBe("available offline");
  });

  it("atomically preserves the newest cursor when refreshes race", async () => {
    const baseline = signManifest({
      contentId: "content-race",
      version: "1",
      revoked: false,
      sequence: { revision: 1, governance: 1 },
    });
    const next = signManifest({
      contentId: "content-race",
      version: "2",
      revoked: false,
      sequence: { revision: 2, governance: 1 },
    });
    const newest = signManifest({
      contentId: "content-race",
      version: null,
      revoked: true,
      sequence: { revision: 2, governance: 2 },
    });
    expect(await refreshLessonAvailability(baseline!)).toBe(true);

    const results = await Promise.all([
      refreshLessonAvailability(next!),
      refreshLessonAvailability(newest!),
    ]);
    expect(results[1]).toBe(true);

    // Regardless of scheduling, the atomic store must end at the greatest
    // revision-first cursor. Replaying the intermediate cursor is stale.
    expect(await refreshLessonAvailability(next!)).toBe(false);
  });

  it("keeps the trust baseline when lesson bytes are explicitly removed", async () => {
    const old = signManifest({
      contentId: "content-removed",
      version: "1",
      revoked: false,
      sequence: { revision: 1, governance: 1 },
    });
    const current = signManifest({
      contentId: "content-removed",
      version: "2",
      revoked: false,
      sequence: { revision: 2, governance: 1 },
    });
    expect(await refreshLessonAvailability(old!)).toBe(true);
    expect(await refreshLessonAvailability(current!)).toBe(true);

    await removeCachedLesson("content-removed");
    expect(await refreshLessonAvailability(old!)).toBe(false);
  });

  it("does not expire the trust baseline with ordinary cache TTL cleanup", async () => {
    const old = signManifest({
      contentId: "content-expiry",
      version: "1",
      revoked: false,
      sequence: { revision: 1, governance: 1 },
    });
    const current = signManifest({
      contentId: "content-expiry",
      version: null,
      revoked: true,
      sequence: { revision: 1, governance: 2 },
    });
    expect(await refreshLessonAvailability(old!)).toBe(true);
    expect(await refreshLessonAvailability(current!)).toBe(true);

    configureCacheLifecycle({ ttlMs: 1 });
    await purgeExpiredPacks(undefined, Date.now() + 60_000);
    expect(await refreshLessonAvailability(old!)).toBe(false);
  });

  it("retains rollback state through the normal partition purge path", async () => {
    const old = signManifest({
      contentId: "content-partition-purge",
      version: "1",
      revoked: false,
      sequence: { revision: 1, governance: 1 },
    });
    const current = signManifest({
      contentId: "content-partition-purge",
      version: null,
      revoked: true,
      sequence: { revision: 1, governance: 2 },
    });
    expect(await refreshLessonAvailability(old!)).toBe(true);
    expect(await refreshLessonAvailability(current!)).toBe(true);

    await purgePartitionPacks();
    expect(await refreshLessonAvailability(old!)).toBe(false);
  });
});
