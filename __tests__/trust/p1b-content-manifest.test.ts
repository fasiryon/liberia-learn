import { afterEach, describe, expect, it, vi } from "vitest";
import { createSign, generateKeyPairSync } from "crypto";
import { signContentAvailability } from "@/lib/content-availability-manifest.server";
import {
  serializeContentAvailability,
  verifyContentAvailabilityManifest,
  type ContentAvailabilityPayload,
} from "@/lib/content-availability-manifest";

const originalPrivateKey = process.env.CONTENT_MANIFEST_PRIVATE_KEY;
const originalKeyId = process.env.CONTENT_MANIFEST_KEY_ID;

afterEach(() => {
  if (originalPrivateKey === undefined) delete process.env.CONTENT_MANIFEST_PRIVATE_KEY;
  else process.env.CONTENT_MANIFEST_PRIVATE_KEY = originalPrivateKey;
  if (originalKeyId === undefined) delete process.env.CONTENT_MANIFEST_KEY_ID;
  else process.env.CONTENT_MANIFEST_KEY_ID = originalKeyId;
});

describe("P1-B signed content availability manifests", () => {
  it("verifies an authentic manifest and rejects a tampered revocation state", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    process.env.CONTENT_MANIFEST_PRIVATE_KEY = privateKey;
    process.env.CONTENT_MANIFEST_KEY_ID = "test-key-2026-08";

    const manifest = signContentAvailability({ contentId: "lesson-1", version: "7", revoked: false });
    expect(manifest).not.toBeNull();
    await expect(verifyContentAvailabilityManifest(manifest!, publicKey)).resolves.toBe(true);

    const tampered = {
      ...manifest!,
      payload: { ...manifest!.payload, revoked: true },
    };
    await expect(verifyContentAvailabilityManifest(tampered, publicKey)).resolves.toBe(false);
  });

  it("does not issue a manifest without server signing configuration", () => {
    delete process.env.CONTENT_MANIFEST_PRIVATE_KEY;
    delete process.env.CONTENT_MANIFEST_KEY_ID;
    expect(signContentAvailability({ contentId: "lesson-1", version: "7", revoked: false })).toBeNull();
  });

  it("P5-A envelope: sequence is signed and verified (Phase B); expiresAt/minClientVersion/contents remain excluded (not yet wired)", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    process.env.CONTENT_MANIFEST_PRIVATE_KEY = privateKey;
    process.env.CONTENT_MANIFEST_KEY_ID = "test-key-2026-08";

    const withoutEnvelopeFields = signContentAvailability({ contentId: "lesson-1", version: "7", revoked: false });
    const withEnvelopeFields = signContentAvailability({
      contentId: "lesson-1",
      version: "7",
      revoked: false,
      expiresAt: "2027-01-01T00:00:00.000Z",
      minClientVersion: "1.4.0",
      contents: [{ contentId: "lesson-1", version: "7" }],
    });

    expect(withoutEnvelopeFields).not.toBeNull();
    expect(withEnvelopeFields).not.toBeNull();

    // sequence is now always populated by the signer itself (server clock), regardless of caller input.
    expect(typeof withoutEnvelopeFields!.payload.sequence).toBe("number");
    expect(typeof withEnvelopeFields!.payload.sequence).toBe("number");

    // The three still-unwired fields never reached the signed payload.
    expect((withEnvelopeFields!.payload as Record<string, unknown>).expiresAt).toBeUndefined();
    expect((withEnvelopeFields!.payload as Record<string, unknown>).minClientVersion).toBeUndefined();
    expect((withEnvelopeFields!.payload as Record<string, unknown>).contents).toBeUndefined();

    // Verification succeeds for both — presence of the still-unwired fields on the input changes nothing.
    await expect(verifyContentAvailabilityManifest(withoutEnvelopeFields!, publicKey)).resolves.toBe(true);
    await expect(verifyContentAvailabilityManifest(withEnvelopeFields!, publicKey)).resolves.toBe(true);
  });

  it("P5-A Phase B: rejects a captured, still-validly-signed older manifest replayed after a newer one was already trusted (rollback/replay)", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    process.env.CONTENT_MANIFEST_PRIVATE_KEY = privateKey;
    process.env.CONTENT_MANIFEST_KEY_ID = "test-key-2026-08";

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-24T00:00:00.000Z"));
      const older = signContentAvailability({ contentId: "lesson-1", version: "7", revoked: false });

      vi.setSystemTime(new Date("2026-08-25T00:00:00.000Z"));
      const newer = signContentAvailability({ contentId: "lesson-1", version: "7", revoked: true });

      expect(older).not.toBeNull();
      expect(newer).not.toBeNull();
      expect(newer!.payload.sequence).toBeGreaterThan(older!.payload.sequence!);

      // Both are independently, cryptographically authentic.
      await expect(verifyContentAvailabilityManifest(older!, publicKey)).resolves.toBe(true);
      await expect(verifyContentAvailabilityManifest(newer!, publicKey)).resolves.toBe(true);

      // The device already trusts `newer` (e.g. it applied the revocation). A captured/replayed
      // `older` manifest — still validly signed — must be rejected as a rollback, not silently accepted.
      await expect(
        verifyContentAvailabilityManifest(older!, publicKey, newer!.payload.sequence)
      ).resolves.toBe(false);

      // A genuinely newer manifest is still accepted against an older trusted baseline.
      await expect(
        verifyContentAvailabilityManifest(newer!, publicKey, older!.payload.sequence)
      ).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("P5-A Phase B: rejects a manifest whose sequence was tampered after signing", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    process.env.CONTENT_MANIFEST_PRIVATE_KEY = privateKey;
    process.env.CONTENT_MANIFEST_KEY_ID = "test-key-2026-08";

    const manifest = signContentAvailability({ contentId: "lesson-1", version: "7", revoked: false });
    expect(manifest).not.toBeNull();

    const tamperedSequence = {
      ...manifest!,
      payload: { ...manifest!.payload, sequence: (manifest!.payload.sequence ?? 0) + 1_000_000 },
    };
    await expect(verifyContentAvailabilityManifest(tamperedSequence, publicKey)).resolves.toBe(false);
  });

  it("P5-A Phase B: a genuinely legacy manifest (no sequence in the signed bytes, predating this field) still verifies when no baseline is supplied, and is rejected once one is", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    // Hand-sign a manifest with no `sequence` at all, mirroring exactly what
    // signContentAvailability produced before Phase B — a real, independently
    // signed manifest, not `signContentAvailability`'s output with a field deleted.
    const legacyPayload: ContentAvailabilityPayload = {
      contentId: "lesson-1",
      version: "7",
      revoked: false,
      issuedAt: "2026-08-01T00:00:00.000Z",
    };
    const signer = createSign("RSA-SHA256");
    signer.update(serializeContentAvailability(legacyPayload));
    signer.end();
    const legacyManifest = { payload: legacyPayload, signature: signer.sign(privateKey, "base64"), keyId: "legacy-key" };

    // No baseline to compare against (e.g. first-time caching) — verifies exactly as before Phase B.
    await expect(verifyContentAvailabilityManifest(legacyManifest, publicKey)).resolves.toBe(true);

    // Once a caller does have a trusted baseline, an undated manifest cannot be used to satisfy it —
    // it is treated as a rollback attempt, not silently trusted just because it lacks the field.
    await expect(verifyContentAvailabilityManifest(legacyManifest, publicKey, 1)).resolves.toBe(false);
  });
});
