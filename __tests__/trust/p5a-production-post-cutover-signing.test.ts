import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "crypto";
import {
  createManifestSigningProof,
  resolveManifestSigningMode,
} from "../../scripts/p2a-production-post-cutover";

// The orchestration boundary under test does not touch the database. Mocking
// only that unrelated import keeps this focused test runnable without a
// generated Prisma client while leaving signing and verification real.
vi.mock("../../lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {},
  Prisma: { JsonNull: null, raw: vi.fn(), sql: vi.fn() },
}));

const SIGNING_ENV_NAMES = [
  "CONTENT_MANIFEST_PRIVATE_KEY",
  "CONTENT_MANIFEST_KEY_ID",
  "NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY",
  "NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS",
  "P2A_ALLOW_SYNTHETIC_SIGNING_PROOF",
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  SIGNING_ENV_NAMES.map((name) => [name, process.env[name]]),
) as Record<(typeof SIGNING_ENV_NAMES)[number], string | undefined>;

function clearSigningEnv() {
  for (const name of SIGNING_ENV_NAMES) delete process.env[name];
}

function restoreSigningEnv() {
  for (const name of SIGNING_ENV_NAMES) {
    const original = ORIGINAL_ENV[name];
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
}

function pair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
}

const proofInput = {
  contentId: "p2a-signing-test",
  version: null,
  revoked: true,
  issuedAt: "2026-08-27T00:00:00.000Z",
  sequence: { revision: 1, governance: 1 },
  expiresAt: "2026-09-03T00:00:00.000Z",
  minClientVersion: "1.0.0",
  contents: [],
};

describe("P2-A post-cutover signing authorization", () => {
  beforeEach(clearSigningEnv);
  afterEach(restoreSigningEnv);

  const cases: Array<{
    name: string;
    privateKey?: string;
    keyId?: string;
    syntheticOptIn?: string;
    expected: "REAL" | "EPHEMERAL" | "UNAVAILABLE";
  }> = [
    { name: "complete real signing config", privateKey: "private", keyId: "active", expected: "REAL" },
    { name: "exact synthetic opt-in without real config", syntheticOptIn: "true", expected: "EPHEMERAL" },
    { name: "no config and no opt-in", expected: "UNAVAILABLE" },
    { name: "private key only with opt-in", privateKey: "private", syntheticOptIn: "true", expected: "UNAVAILABLE" },
    { name: "key ID only with opt-in", keyId: "active", syntheticOptIn: "true", expected: "UNAVAILABLE" },
    { name: "space-padded synthetic opt-in", syntheticOptIn: " true ", expected: "UNAVAILABLE" },
    { name: "uppercase synthetic opt-in", syntheticOptIn: "TRUE", expected: "UNAVAILABLE" },
    { name: "numeric synthetic opt-in", syntheticOptIn: "1", expected: "UNAVAILABLE" },
    { name: "word synthetic opt-in", syntheticOptIn: "yes", expected: "UNAVAILABLE" },
    { name: "real config always wins", privateKey: "private", keyId: "active", syntheticOptIn: "true", expected: "REAL" },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(resolveManifestSigningMode(testCase)).toBe(testCase.expected);
    });
  }

  it.each([
    ["true", "EPHEMERAL"],
    [" true ", "UNAVAILABLE"],
    ["TRUE", "UNAVAILABLE"],
    ["True", "UNAVAILABLE"],
    ["1", "UNAVAILABLE"],
    ["yes", "UNAVAILABLE"],
    ["", "UNAVAILABLE"],
    [undefined, "UNAVAILABLE"],
  ] as const)("uses only exact synthetic authorization %j", (syntheticOptIn, expected) => {
    expect(resolveManifestSigningMode({ syntheticOptIn })).toBe(expected);
  });

  it("executes the real orchestration boundary successfully in registry-only mode", async () => {
    const real = pair();
    process.env.CONTENT_MANIFEST_PRIVATE_KEY = real.privateKey;
    process.env.CONTENT_MANIFEST_KEY_ID = "real-key";
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS = JSON.stringify([
      { keyId: "real-key", publicKeyPem: real.publicKey },
    ]);

    const proof = await createManifestSigningProof(proofInput);

    expect(proof.signingMode).toBe("REAL");
    expect(proof.manifestVerified).toBe(true);
    expect(proof.manifest.keyId).toBe("real-key");
    expect(proof.operatorOutput).toEqual({
      SIGNING_MODE: "REAL",
      SYNTHETIC_SIGNING_PROOF: false,
    });
  });

  it("executes the exact-opt-in ephemeral orchestration successfully and marks it synthetic", async () => {
    process.env.P2A_ALLOW_SYNTHETIC_SIGNING_PROOF = "true";

    const proof = await createManifestSigningProof(proofInput);

    expect(proof.signingMode).toBe("EPHEMERAL");
    expect(proof.manifestVerified).toBe(true);
    expect(proof.manifest.keyId).toMatch(/^p2a-safe-/);
    expect(proof.operatorOutput).toEqual({
      SIGNING_MODE: "EPHEMERAL",
      SYNTHETIC_SIGNING_PROOF: true,
    });
  });

  it("stops at the orchestration boundary when signing is unavailable", async () => {
    await expect(createManifestSigningProof(proofInput)).rejects.toThrow(/STOP/);
  });

  it("stops partial real configuration even when synthetic authorization is exact", async () => {
    process.env.CONTENT_MANIFEST_PRIVATE_KEY = "private";
    process.env.P2A_ALLOW_SYNTHETIC_SIGNING_PROOF = "true";

    await expect(createManifestSigningProof(proofInput)).rejects.toThrow(/STOP/);
  });

  it("does not claim EPHEMERAL for a successful real proof", async () => {
    const real = pair();
    process.env.CONTENT_MANIFEST_PRIVATE_KEY = real.privateKey;
    process.env.CONTENT_MANIFEST_KEY_ID = "real-key";
    process.env.NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY = real.publicKey;

    const proof = await createManifestSigningProof(proofInput);

    expect(proof.operatorOutput.SIGNING_MODE).toBe("REAL");
    expect(proof.operatorOutput.SYNTHETIC_SIGNING_PROOF).toBe(false);
  });
});
