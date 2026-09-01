import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { hashContentAvailabilityData as hashServerData, signContentAvailability } from "@/lib/content-availability-manifest.server";
import {
  acceptsContentAvailabilityManifest,
  acceptsManifestPolicy,
  hashContentAvailabilityData,
  isManifestCompatibleWithClient,
  serializeContentAvailability,
  type ContentAvailabilityPayload,
  type ContentAvailabilitySequence,
  type SignedContentAvailabilityManifest,
  verifyContentAvailabilityManifest,
} from "@/lib/content-availability-manifest";
import {
  cacheLessonContent,
  isLessonCached,
  loadCachedLesson,
  refreshLessonAvailability,
} from "@/lib/lesson-offline-cache";

const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (key: string) => store.get(key),
  set: async (key: string, value: unknown) => { store.set(key, value); },
  update: async (key: string, updater: (value: unknown) => unknown) => {
    store.set(key, updater(store.get(key)));
  },
  del: async (key: string) => { store.delete(key); },
}));
vi.mock("@/lib/offline-session", () => ({
  resolveSessionPartition: () => ({ key: "default" }),
  detectAndSetActiveSessionPartition: () => null,
}));

const originalPrivateKey = process.env.CONTENT_MANIFEST_PRIVATE_KEY;
const originalKeyId = process.env.CONTENT_MANIFEST_KEY_ID;
const originalPublicKey = process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY;
const originalPublicKeys = process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS;

let privateKey: string;
let publicKey: string;

function contentData(contentId: string, version: string, title = "Water cycle") {
  return {
    metadata: { contentId, grade: 6, subject: "SCIENCE", version },
    payload: { title, body: "Water changes state." },
    audio: null,
  };
}

function manifest(input: {
  contentId: string;
  version: string | null;
  revoked?: boolean;
  sequence?: ContentAvailabilitySequence;
  expiresAt?: string;
  minClientVersion?: string;
  contents?: SignedContentAvailabilityManifest["payload"]["contents"];
  issuedAt?: string;
}): SignedContentAvailabilityManifest {
  const data = input.version ? contentData(input.contentId, input.version) : null;
  const sha256 = data
    ? hashServerData({ contentId: input.contentId, version: input.version!, ...data })!
    : null;
  const signed = signContentAvailability({
    contentId: input.contentId,
    version: input.version,
    revoked: input.revoked ?? false,
    issuedAt: input.issuedAt ?? "2026-08-25T00:00:00.000Z",
    sequence: input.sequence ?? { revision: 1, governance: 1 },
    expiresAt: input.expiresAt ?? "2026-09-01T00:00:00.000Z",
    minClientVersion: input.minClientVersion ?? "1.0.0",
    contents: input.contents ?? (input.revoked ? [] : [{
      contentId: input.contentId,
      version: input.version!,
      sha256,
    }]),
  });
  if (!signed) throw new Error("test manifest was not issued");
  return signed;
}

describe("P5-A manifest policy authority", () => {
  beforeEach(() => {
    store.clear();
    // The current-policy fixtures intentionally expire on September 1. Fix
    // the clock so their validity does not depend on the CI calendar date.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    const pair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
    process.env.CONTENT_MANIFEST_PRIVATE_KEY = privateKey;
    process.env.CONTENT_MANIFEST_KEY_ID = "policy-key";
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
    if (originalPublicKeys === undefined) delete process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS;
    else process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS = originalPublicKeys;
  });

  it("signs and verifies expiry, client compatibility, contents, and hashes with real RSA", async () => {
    const current = manifest({ contentId: "lesson-policy", version: "1", sequence: { revision: 2, governance: 3 } });
    expect(await verifyContentAvailabilityManifest(current, publicKey)).toBe(true);
    expect(isManifestCompatibleWithClient(current, "1.0.0")).toBe(true);
    expect(isManifestCompatibleWithClient({
      ...current,
      payload: { ...current.payload, minClientVersion: "2.0.0" },
    }, "1.0.0")).toBe(false);

    for (const field of ["expiresAt", "minClientVersion", "contents"] as const) {
      const tampered = {
        ...current,
        payload: {
          ...current.payload,
          [field]: field === "expiresAt"
            ? "2027-01-01T00:00:00.000Z"
            : field === "minClientVersion"
              ? "9.0.0"
              : [{ contentId: "lesson-policy", version: "1", sha256: "f".repeat(64) }],
        },
      };
      await expect(verifyContentAvailabilityManifest(tampered, publicKey)).resolves.toBe(false);
    }
    await expect(verifyContentAvailabilityManifest({
      ...current,
      payload: {
        ...current.payload,
        contents: [{ contentId: "lesson-policy", version: "1", sha256: "f".repeat(64) }],
      },
    }, publicKey)).resolves.toBe(false);
  });

  it("canonicalizes contents order but rejects duplicate identities and malformed hashes", async () => {
    const first = manifest({
      contentId: "lesson-order",
      version: "1",
      contents: [
        { contentId: "lesson-order", version: "1", sha256: "0".repeat(64) },
      ],
    });
    const reorderedPayload: ContentAvailabilityPayload = {
      ...first.payload,
      contents: [...first.payload.contents!].reverse(),
    };
    expect(serializeContentAvailability(reorderedPayload)).toBe(serializeContentAvailability(first.payload));
    expect(acceptsContentAvailabilityManifest(first, first)).toBe(true);

    const duplicate = { ...first, payload: {
      ...first.payload,
      contents: [
        ...first.payload.contents!,
        { contentId: "lesson-order", version: "2", sha256: "0".repeat(64) },
      ],
    }};
    expect(acceptsManifestPolicy(duplicate)).toBe(false);
    expect(acceptsManifestPolicy({ ...first, payload: {
      ...first.payload,
      contents: [{ contentId: "lesson-order", version: "1", sha256: "A".repeat(64) }],
    }})).toBe(false);
  });

  it("fails closed for expiry and unknown client versions while preserving revocation authority", () => {
    const expired = manifest({
      contentId: "lesson-expired",
      version: "1",
      expiresAt: "2026-08-26T00:00:00.000Z",
    });
    expect(acceptsManifestPolicy(expired, Date.parse("2026-08-27T00:00:00.000Z"), "1.0.0")).toBe(false);
    expect(isManifestCompatibleWithClient(expired, "not-a-version")).toBe(false);

    const revoked = manifest({
      contentId: "lesson-revoked",
      version: null,
      revoked: true,
      sequence: { revision: 1, governance: 2 },
      expiresAt: "2026-08-26T00:00:00.000Z",
      minClientVersion: "99.0.0",
    });
    expect(acceptsManifestPolicy(revoked, Date.parse("2026-08-27T00:00:00.000Z"), "1.0.0")).toBe(true);
    expect(acceptsContentAvailabilityManifest(expired, revoked)).toBe(false);
    expect(acceptsContentAvailabilityManifest(revoked, expired)).toBe(true);
  });

  it("rejects content/hash substitution before cache mutation and on offline read", async () => {
    const signed = manifest({ contentId: "lesson-hash", version: "1" });
    expect(await cacheLessonContent("lesson-hash", contentData("lesson-hash", "1"), signed)).toBe(true);
    expect(await loadCachedLesson("lesson-hash")).not.toBeNull();

    const tampered = await cacheLessonContent(
      "lesson-hash",
      contentData("lesson-hash", "1", "Tampered lesson"),
      signed,
    );
    expect(tampered).toBe(false);
    expect(await loadCachedLesson("lesson-hash")).not.toBeNull();

    const current = await import("@/lib/offline-cache").then(({ getCachedPack }) =>
      getCachedPack<SignedContentAvailabilityManifest>("lesson-availability", "lesson-hash"));
    expect(current?.payload.contents?.[0].sha256).toBe(signed.payload.contents?.[0].sha256);
  });

  it("does not report expired cached content as available", async () => {
    const signed = manifest({ contentId: "lesson-status", version: "1" });
    const data = contentData("lesson-status", "1");
    expect(await cacheLessonContent("lesson-status", data, signed)).toBe(true);
    expect(await isLessonCached("lesson-status")).toBe(true);

    const expired = manifest({
      contentId: "lesson-status",
      version: "1",
      expiresAt: "2026-08-26T00:00:00.000Z",
    });
    const { cachePack } = await import("@/lib/offline-cache");
    await cachePack("lesson-availability", "lesson-status", "revision-1:governance-1", expired);

    expect(await isLessonCached("lesson-status")).toBe(false);
    expect(await loadCachedLesson("lesson-status")).toBeNull();
  });

  it("keeps Phase B ordering dominant over policy differences", () => {
    const older = manifest({ contentId: "lesson-ordering", version: "1", sequence: { revision: 4, governance: 9 }, minClientVersion: "1.0.0" });
    const newerExpired = manifest({ contentId: "lesson-ordering", version: "2", sequence: { revision: 5, governance: 0 }, expiresAt: "2026-08-26T00:00:00.000Z", minClientVersion: "9.0.0" });
    expect(acceptsContentAvailabilityManifest(newerExpired, older)).toBe(true);
    expect(acceptsManifestPolicy(newerExpired, Date.parse("2026-08-27T00:00:00.000Z"), "1.0.0")).toBe(false);
    expect(acceptsContentAvailabilityManifest(older, newerExpired)).toBe(false);

    const higherStricter = manifest({ contentId: "lesson-ordering", version: "3", sequence: { revision: 6, governance: 0 }, minClientVersion: "99.0.0" });
    expect(acceptsContentAvailabilityManifest(higherStricter, newerExpired)).toBe(true);

    const renewal = manifest({
      contentId: "lesson-ordering",
      version: "1",
      sequence: { revision: 4, governance: 9 },
      issuedAt: "2026-08-26T00:00:00.000Z",
      expiresAt: "2026-09-02T00:00:00.000Z",
    });
    expect(acceptsContentAvailabilityManifest(renewal, older)).toBe(true);
    expect(acceptsContentAvailabilityManifest(manifest({
      contentId: "lesson-ordering",
      version: "1",
      sequence: { revision: 4, governance: 9 },
      issuedAt: "2026-08-26T00:00:00.000Z",
      expiresAt: "2026-09-02T00:00:00.000Z",
      minClientVersion: "2.0.0",
    }), older)).toBe(false);
  });

  it("preserves explicit legacy compatibility without treating absent policy as trusted", async () => {
    const legacyPayload: ContentAvailabilityPayload = {
      contentId: "lesson-legacy",
      version: "1",
      revoked: false,
      issuedAt: "2026-08-01T00:00:00.000Z",
    };
    const { createSign } = await import("node:crypto");
    const signer = createSign("RSA-SHA256");
    signer.update(serializeContentAvailability(legacyPayload));
    signer.end();
    const legacy = {
      payload: legacyPayload,
      signature: signer.sign(privateKey, "base64"),
      keyId: "legacy-key",
    };
    expect(await verifyContentAvailabilityManifest(legacy, publicKey)).toBe(true);
    expect(acceptsManifestPolicy(legacy)).toBe(true);
    expect(await cacheLessonContent("lesson-legacy", { metadata: { version: "1" }, payload: { title: "legacy" } }, legacy)).toBe(true);
    expect(await loadCachedLesson("lesson-legacy")).not.toBeNull();
  });

  it("keeps Phase C key retirement and rotation behavior unchanged for policy manifests", async () => {
    const nextPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const old = manifest({ contentId: "lesson-keys", version: "1", sequence: { revision: 2, governance: 1 } });
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS = JSON.stringify([
      { keyId: "policy-key", publicKeyPem: publicKey },
      { keyId: "next-key", publicKeyPem: nextPair.publicKey },
    ]);
    expect(await verifyContentAvailabilityManifest(old)).toBe(true);
    expect(await verifyContentAvailabilityManifest(old, nextPair.publicKey)).toBe(false);

    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS = JSON.stringify([
      { keyId: "next-key", publicKeyPem: nextPair.publicKey },
    ]);
    // The retired key cannot fall back to NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY.
    expect(await verifyContentAvailabilityManifest(old)).toBe(false);

    process.env.CONTENT_MANIFEST_PRIVATE_KEY = nextPair.privateKey;
    process.env.CONTENT_MANIFEST_KEY_ID = "next-key";
    const rotated = manifest({ contentId: "lesson-keys", version: "2", sequence: { revision: 3, governance: 0 } });
    expect(await verifyContentAvailabilityManifest(rotated)).toBe(true);
  });
});
