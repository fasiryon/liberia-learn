// __tests__/validateEnv.test.ts
// Verifies that validateEnv throws on missing required vars and warns on recommended ones.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "OPENAI_API_KEY",
  "AT_API_KEY",
];

const RECOMMENDED = ["SENTRY_DSN", "AT_USERNAME"];

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  // Save and clear all relevant env vars
  for (const k of [...REQUIRED, ...RECOMMENDED]) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of [...REQUIRED, ...RECOMMENDED]) {
    if (savedEnv[k] !== undefined) {
      process.env[k] = savedEnv[k];
    } else {
      delete process.env[k];
    }
  }
});

function setAllRequired() {
  process.env.DATABASE_URL = "postgresql://test";
  process.env.DIRECT_URL = "postgresql://test-direct";
  process.env.NEXTAUTH_SECRET = "test-secret-32chars-xxxxxxxxxxxx";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.AT_API_KEY = "at-test-key";
}

describe("validateEnv", () => {
  it("throws when DATABASE_URL is missing", async () => {
    const { validateEnv } = await import("@/lib/validateEnv");
    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it("lists all missing required vars in the error message", async () => {
    const { validateEnv } = await import("@/lib/validateEnv");
    expect(() => validateEnv()).toThrow(
      /DATABASE_URL.*DIRECT_URL.*NEXTAUTH_SECRET.*NEXTAUTH_URL.*OPENAI_API_KEY.*AT_API_KEY/s
    );
  });

  it("throws only for missing vars, not present ones", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    process.env.DIRECT_URL = "postgresql://test-direct";
    const { validateEnv } = await import("@/lib/validateEnv");
    const err = (() => { try { validateEnv(); } catch (e) { return e as Error; } })();
    expect(err?.message).not.toMatch(/DATABASE_URL/);
    expect(err?.message).not.toMatch(/DIRECT_URL/);
    expect(err?.message).toMatch(/NEXTAUTH_SECRET/);
  });

  it("does not throw when all required vars are set", async () => {
    setAllRequired();
    const { validateEnv } = await import("@/lib/validateEnv");
    expect(() => validateEnv()).not.toThrow();
  });

  it("warns on recommended vars that are missing", async () => {
    setAllRequired();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateEnv } = await import("@/lib/validateEnv");
    validateEnv();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("SENTRY_DSN"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("AT_USERNAME"));
    warnSpy.mockRestore();
  });

  it("does not warn when recommended vars are present", async () => {
    setAllRequired();
    process.env.SENTRY_DSN = "https://sentry.io/test";
    process.env.AT_USERNAME = "sandbox";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateEnv } = await import("@/lib/validateEnv");
    validateEnv();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
