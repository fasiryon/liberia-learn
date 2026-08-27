import { describe, expect, it } from "vitest";
import { resolveManifestSigningMode } from "../../scripts/p2a-production-post-cutover";

describe("P2-A post-cutover signing authorization", () => {
  const cases: Array<{
    name: string;
    privateKey?: string;
    keyId?: string;
    syntheticOptIn?: string;
    expected: "real" | "ephemeral" | "stop";
  }> = [
    { name: "complete real signing config", privateKey: "private", keyId: "active", expected: "real" },
    { name: "private key only", privateKey: "private", expected: "stop" },
    { name: "key ID only", keyId: "active", expected: "stop" },
    { name: "missing config by default", expected: "stop" },
    { name: "explicit false opt-in", syntheticOptIn: "false", expected: "stop" },
    { name: "malformed opt-in", syntheticOptIn: "yes", expected: "stop" },
    { name: "explicit synthetic opt-in", syntheticOptIn: "true", expected: "ephemeral" },
    { name: "private key only with opt-in", privateKey: "private", syntheticOptIn: "true", expected: "stop" },
    { name: "key ID only with opt-in", keyId: "active", syntheticOptIn: "true", expected: "stop" },
    { name: "real config always wins", privateKey: "private", keyId: "active", syntheticOptIn: "true", expected: "real" },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      if (testCase.expected === "stop") {
        expect(() => resolveManifestSigningMode(testCase)).toThrow(/STOP/);
      } else {
        expect(resolveManifestSigningMode(testCase)).toBe(testCase.expected);
      }
    });
  }

  it("does not inspect verification-only configuration", () => {
    expect(resolveManifestSigningMode({ privateKey: "private", keyId: "active" })).toBe("real");
    expect(resolveManifestSigningMode({ syntheticOptIn: "true" })).toBe("ephemeral");
  });
});
