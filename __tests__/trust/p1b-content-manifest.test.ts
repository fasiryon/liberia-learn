import { afterEach, describe, expect, it } from "vitest";
import { generateKeyPairSync } from "crypto";
import { signContentAvailability } from "@/lib/content-availability-manifest.server";
import { verifyContentAvailabilityManifest } from "@/lib/content-availability-manifest";

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
});
