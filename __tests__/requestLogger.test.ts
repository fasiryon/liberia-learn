import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  hashUserId,
  logRequest,
  withRequestLogging,
} from "@/lib/logging/requestLogger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<Parameters<typeof logRequest>[0]> = {}) {
  return {
    method: "GET",
    route: "/api/test",
    statusCode: 200,
    durationMs: 42,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function parsedLog(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  // In non-dev environments the logger calls console.log(json) — single arg
  const arg = spy.mock.calls[0][0] as string;
  return JSON.parse(arg);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("logRequest", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    delete process.env.LOG_LEVEL;
  });

  it("produces JSON output", () => {
    logRequest(makeEntry());

    expect(consoleSpy).toHaveBeenCalledOnce();
    const arg = consoleSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(arg)).not.toThrow();

    const parsed = parsedLog(consoleSpy);
    expect(parsed.method).toBe("GET");
    expect(parsed.route).toBe("/api/test");
    expect(parsed.statusCode).toBe(200);
  });

  it("hashes userId and does not include the raw value", () => {
    const rawId = "user-abc-123-secret";
    logRequest(makeEntry({ userId: rawId }));

    const parsed = parsedLog(consoleSpy);
    expect(parsed.userId).toBeUndefined();
    expect(parsed.userIdHash).toBeDefined();
    expect(parsed.userIdHash).not.toBe(rawId);
    expect(parsed.userIdHash).toBe(hashUserId(rawId));
  });

  it("does not include request body PII fields in output", () => {
    // The interface does not accept body/email/password/submissionContent —
    // this test confirms the emitted JSON never contains those keys.
    logRequest(makeEntry({ method: "POST" }));

    const parsed = parsedLog(consoleSpy);
    expect(parsed).not.toHaveProperty("body");
    expect(parsed).not.toHaveProperty("email");
    expect(parsed).not.toHaveProperty("password");
    expect(parsed).not.toHaveProperty("submissionContent");
    expect(parsed).not.toHaveProperty("token");
  });

  it("captures statusCode and durationMs", () => {
    logRequest(makeEntry({ statusCode: 422, durationMs: 75 }));

    const parsed = parsedLog(consoleSpy);
    expect(parsed.statusCode).toBe(422);
    expect(parsed.durationMs).toBe(75);
  });

  it("includes optional fields when provided", () => {
    logRequest(
      makeEntry({ schoolId: "school-1", role: "TEACHER" })
    );

    const parsed = parsedLog(consoleSpy);
    expect(parsed.schoolId).toBe("school-1");
    expect(parsed.role).toBe("TEACHER");
  });

  it("omits optional fields when not provided", () => {
    logRequest(makeEntry());

    const parsed = parsedLog(consoleSpy);
    expect(parsed).not.toHaveProperty("userIdHash");
    expect(parsed).not.toHaveProperty("schoolId");
    expect(parsed).not.toHaveProperty("role");
  });

  it("is silent when LOG_LEVEL=silent", () => {
    process.env.LOG_LEVEL = "silent";
    logRequest(makeEntry());

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

// ─── hashUserId ───────────────────────────────────────────────────────────────

describe("hashUserId", () => {
  it("returns 16 hex characters", () => {
    const hash = hashUserId("user-123");
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashUserId("user-abc")).toBe(hashUserId("user-abc"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashUserId("user-a")).not.toBe(hashUserId("user-b"));
  });
});

// ─── withRequestLogging ───────────────────────────────────────────────────────

describe("withRequestLogging", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    delete process.env.LOG_LEVEL;
  });

  it("logs statusCode and route on success", async () => {
    const handler = async (_req: any) => new Response(null, { status: 200 });
    const wrapped = withRequestLogging("/api/demo", handler);

    await wrapped({ method: "GET" });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const parsed = parsedLog(consoleSpy);
    expect(parsed.route).toBe("/api/demo");
    expect(parsed.statusCode).toBe(200);
    expect(parsed.method).toBe("GET");
  });

  it("captures durationMs >= 0", async () => {
    const handler = async () => new Response(null, { status: 201 });
    const wrapped = withRequestLogging("/api/demo", handler);

    await wrapped({ method: "POST" });

    const parsed = parsedLog(consoleSpy);
    expect(typeof parsed.durationMs).toBe("number");
    expect(parsed.durationMs as number).toBeGreaterThanOrEqual(0);
  });

  it("logs on error and re-throws", async () => {
    const err = Object.assign(new Error("Forbidden"), { status: 403 });
    const handler = async () => {
      throw err;
    };
    const wrapped = withRequestLogging("/api/demo", handler);

    await expect(wrapped({ method: "DELETE" })).rejects.toThrow("Forbidden");

    expect(consoleSpy).toHaveBeenCalledOnce();
    const parsed = parsedLog(consoleSpy);
    expect(parsed.statusCode).toBe(403);
  });

  it("is silent when LOG_LEVEL=silent even for wrapped handlers", async () => {
    process.env.LOG_LEVEL = "silent";
    const handler = async () => new Response(null, { status: 200 });
    const wrapped = withRequestLogging("/api/demo", handler);

    await wrapped({ method: "GET" });

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
