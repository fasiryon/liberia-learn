import { describe, it, expect, beforeEach } from "vitest";

// Isolate env so each test gets a clean secret
beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-for-unit-tests";
});

import { generateShareToken, verifyShareToken } from "@/lib/certificates/shareToken";

describe("generateShareToken", () => {
  it("returns a non-empty base64url string", () => {
    const token = generateShareToken("cert-abc-123");
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    // base64url: no +, /, or = padding
    expect(token).not.toMatch(/[+/=]/);
  });

  it("is deterministic for the same certId + secret", () => {
    const t1 = generateShareToken("cert-abc-123");
    const t2 = generateShareToken("cert-abc-123");
    expect(t1).toBe(t2);
  });

  it("differs for different certificate IDs", () => {
    const t1 = generateShareToken("cert-aaa");
    const t2 = generateShareToken("cert-bbb");
    expect(t1).not.toBe(t2);
  });
});

describe("verifyShareToken", () => {
  it("accepts a valid token", () => {
    const id = "cert-xyz-999";
    const token = generateShareToken(id);
    expect(verifyShareToken(id, token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const id = "cert-xyz-999";
    const token = generateShareToken(id);
    const tampered = token.slice(0, -4) + "XXXX";
    expect(verifyShareToken(id, tampered)).toBe(false);
  });

  it("rejects a token for a different certificate", () => {
    const token = generateShareToken("cert-A");
    expect(verifyShareToken("cert-B", token)).toBe(false);
  });

  it("rejects an empty token", () => {
    expect(verifyShareToken("cert-abc", "")).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(verifyShareToken("cert-abc", "not-a-valid-token-at-all")).toBe(false);
  });
});
