import { afterEach, describe, expect, it } from "vitest";
import { generateKeyPairSync } from "crypto";
import { signContentAvailability } from "@/lib/content-availability-manifest.server";
import {
  verifyContentAvailabilityManifest,
  type ContentAvailabilitySequence,
  type SignedContentAvailabilityManifest,
} from "@/lib/content-availability-manifest";

const ORIGINAL_ENV = {
  privateKey: process.env.CONTENT_MANIFEST_PRIVATE_KEY,
  keyId: process.env.CONTENT_MANIFEST_KEY_ID,
  publicKey: process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY,
  registry: process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS,
};

function restore(name: keyof typeof ORIGINAL_ENV, envVar: string) {
  const original = ORIGINAL_ENV[name];
  if (original === undefined) delete process.env[envVar];
  else process.env[envVar] = original;
}

afterEach(() => {
  restore("privateKey", "CONTENT_MANIFEST_PRIVATE_KEY");
  restore("keyId", "CONTENT_MANIFEST_KEY_ID");
  restore("publicKey", "NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY");
  restore("registry", "NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS");
});

function pair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
}

function sign(
  privateKey: string,
  keyId: string,
  overrides: Partial<{
    contentId: string;
    version: string | null;
    revoked: boolean;
    issuedAt: string;
    sequence: ContentAvailabilitySequence;
  }> = {},
): SignedContentAvailabilityManifest {
  process.env.CONTENT_MANIFEST_PRIVATE_KEY = privateKey;
  process.env.CONTENT_MANIFEST_KEY_ID = keyId;
  const manifest = signContentAvailability({
    contentId: "lesson-1",
    version: "7",
    revoked: false,
    issuedAt: "2026-08-25T00:00:00.000Z",
    sequence: { revision: 5, governance: 8 },
    ...overrides,
  });
  if (!manifest) throw new Error("test setup failed to sign a manifest");
  return manifest;
}

function registryOf(entries: Array<{ keyId: string; publicKeyPem: string }>) {
  process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS = JSON.stringify(entries);
}

describe("P5-A Phase C: static multi-key verification registry", () => {
  it("1. registry unset (legacy mode): a single existing key still verifies exactly as before", async () => {
    const key = pair();
    delete process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS;
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY = key.publicKey;
    const manifest = sign(key.privateKey, "whatever-id-is-configured");
    await expect(verifyContentAvailabilityManifest(manifest)).resolves.toBe(true);
  });

  it("2. registry with A+B: a manifest signed under A verifies via keyId lookup", async () => {
    const a = pair();
    const b = pair();
    registryOf([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "B", publicKeyPem: b.publicKey },
    ]);
    const manifest = sign(a.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(manifest)).resolves.toBe(true);
  });

  it("3. registry with A+B: a manifest signed under B verifies via keyId lookup", async () => {
    const a = pair();
    const b = pair();
    registryOf([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "B", publicKeyPem: b.publicKey },
    ]);
    const manifest = sign(b.privateKey, "B");
    await expect(verifyContentAvailabilityManifest(manifest)).resolves.toBe(true);
  });

  it("4. unknown keyId fails closed and does not fall through to the legacy var, even when the legacy var holds the correct key", async () => {
    const a = pair();
    // Legacy var is configured to the SAME key that actually signed this manifest.
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY = a.publicKey;
    // But the registry is active and does not know this keyId.
    registryOf([{ keyId: "some-other-key", publicKeyPem: pair().publicKey }]);
    const manifest = sign(a.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(manifest)).resolves.toBe(false);
  });

  it("5. a manifest missing keyId is rejected under registry mode", async () => {
    const a = pair();
    registryOf([{ keyId: "A", publicKeyPem: a.publicKey }]);
    const manifest = sign(a.privateKey, "A");
    const stripped = { ...manifest, keyId: "" } as SignedContentAvailabilityManifest;
    await expect(verifyContentAvailabilityManifest(stripped)).resolves.toBe(false);
  });

  it("6. tampering with keyId (same payload/signature, different key label) rejects", async () => {
    const a = pair();
    const b = pair();
    registryOf([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "B", publicKeyPem: b.publicKey },
    ]);
    const manifest = sign(a.privateKey, "A");
    const tampered = { ...manifest, keyId: "B" };
    await expect(verifyContentAvailabilityManifest(tampered)).resolves.toBe(false);
  });

  it("7. an explicitly wrong key for an otherwise valid signature rejects", async () => {
    const a = pair();
    const wrong = pair();
    const manifest = sign(a.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(manifest, wrong.publicKey)).resolves.toBe(false);
  });

  it("8. retiring a key (removing it from the registry) rejects manifests signed under it", async () => {
    const a = pair();
    registryOf([{ keyId: "A", publicKeyPem: a.publicKey }]);
    const manifest = sign(a.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(manifest)).resolves.toBe(true);

    // A is retired: its entry is removed from the registry.
    registryOf([{ keyId: "B", publicKeyPem: pair().publicKey }]);
    await expect(verifyContentAvailabilityManifest(manifest)).resolves.toBe(false);
  });

  it("9. an old manifest signed under A remains valid once B is added to the registry (rotation window)", async () => {
    const a = pair();
    registryOf([{ keyId: "A", publicKeyPem: a.publicKey }]);
    const oldManifest = sign(a.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(oldManifest)).resolves.toBe(true);

    const b = pair();
    registryOf([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "B", publicKeyPem: b.publicKey },
    ]);
    await expect(verifyContentAvailabilityManifest(oldManifest)).resolves.toBe(true);
  });

  it("10. key rotation does not bypass lower-sequence (rollback) rejection", async () => {
    const a = pair();
    const b = pair();
    registryOf([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "B", publicKeyPem: b.publicKey },
    ]);
    const trusted = sign(a.privateKey, "A", { sequence: { revision: 5, governance: 8 } });
    const rollback = sign(b.privateKey, "B", { sequence: { revision: 5, governance: 7 } });

    await expect(verifyContentAvailabilityManifest(trusted)).resolves.toBe(true);
    await expect(verifyContentAvailabilityManifest(rollback)).resolves.toBe(true);
    // A newer trusted key does not make an older sequence authoritative.
    await expect(verifyContentAvailabilityManifest(rollback, undefined, trusted)).resolves.toBe(false);
  });

  it("11. a genuinely newer revision signed under a new key is accepted against an older trusted baseline", async () => {
    const a = pair();
    const b = pair();
    registryOf([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "B", publicKeyPem: b.publicKey },
    ]);
    const trusted = sign(a.privateKey, "A", { sequence: { revision: 5, governance: 8 } });
    const newer = sign(b.privateKey, "B", { sequence: { revision: 6, governance: 0 } });

    await expect(verifyContentAvailabilityManifest(newer, undefined, trusted)).resolves.toBe(true);
  });

  it("12. a governance-only newer state signed under a new key is accepted", async () => {
    const a = pair();
    const b = pair();
    registryOf([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "B", publicKeyPem: b.publicKey },
    ]);
    const trusted = sign(a.privateKey, "A", { sequence: { revision: 5, governance: 8 } });
    const newer = sign(b.privateKey, "B", { sequence: { revision: 5, governance: 9 } });

    await expect(verifyContentAvailabilityManifest(newer, undefined, trusted)).resolves.toBe(true);
  });

  it("13. equal cursor with a conflicting trust payload rejects even when signed under another trusted key", async () => {
    const a = pair();
    const b = pair();
    registryOf([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "B", publicKeyPem: b.publicKey },
    ]);
    const trusted = sign(a.privateKey, "A", { sequence: { revision: 5, governance: 8 }, revoked: false });
    const conflicting = sign(b.privateKey, "B", { sequence: { revision: 5, governance: 8 }, revoked: true });

    await expect(verifyContentAvailabilityManifest(conflicting, undefined, trusted)).resolves.toBe(false);
  });

  it("14. equal cursor with an identical trust statement re-signed under another trusted key is accepted idempotently", async () => {
    const a = pair();
    const b = pair();
    registryOf([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "B", publicKeyPem: b.publicKey },
    ]);
    const shared = {
      contentId: "lesson-1",
      version: "7",
      revoked: false,
      issuedAt: "2026-08-25T00:00:00.000Z",
      sequence: { revision: 5, governance: 8 },
    };
    const trusted = sign(a.privateKey, "A", shared);
    const resigned = sign(b.privateKey, "B", shared);

    await expect(verifyContentAvailabilityManifest(resigned, undefined, trusted)).resolves.toBe(true);
  });

  it("15a. malformed registry JSON fails closed, even when the legacy var holds the correct key", async () => {
    const a = pair();
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY = a.publicKey;
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS = "{not valid json";
    const manifest = sign(a.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(manifest)).resolves.toBe(false);
  });

  it("15b. a registry that isn't a JSON array fails closed", async () => {
    const a = pair();
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS = JSON.stringify({ A: a.publicKey });
    const manifest = sign(a.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(manifest)).resolves.toBe(false);
  });

  it("15c. a registry entry missing a required field fails closed", async () => {
    const a = pair();
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS = JSON.stringify([{ keyId: "A" }]);
    const manifest = sign(a.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(manifest)).resolves.toBe(false);
  });

  it("15d. duplicate keyId entries in the registry fail closed instead of silently choosing one", async () => {
    const a = pair();
    const b = pair();
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS = JSON.stringify([
      { keyId: "A", publicKeyPem: a.publicKey },
      { keyId: "A", publicKeyPem: b.publicKey },
    ]);
    const manifestA = sign(a.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(manifestA)).resolves.toBe(false);
    const manifestB = sign(b.privateKey, "A");
    await expect(verifyContentAvailabilityManifest(manifestB)).resolves.toBe(false);
  });

  it("16. the client-safe manifest module never imports Node's crypto module or reads the private key", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/content-availability-manifest.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(/from ["']crypto["']/);
    expect(source).not.toMatch(/from ["']node:crypto["']/);
    expect(source).not.toContain("CONTENT_MANIFEST_PRIVATE_KEY");
  });
});
