import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashUserId,
  logRequest,
  withRequestLogging,
} from "@/lib/logging/requestLogger";

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
  const arg = spy.mock.calls[0][0] as string;
  return JSON.parse(arg);
}

describe("logRequest", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    delete process.env.LOG_LEVEL;
    vi.unstubAllEnvs();
  });

  it("produces JSON output", () => {
    logRequest(makeEntry());

    expect(consoleSpy).toHaveBeenCalledOnce();
    const arg = consoleSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(arg)).not.toThrow();

    const parsed = parsedLog(consoleSpy);
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(parsed.message).toBe("HTTP request");
    expect(metadata.method).toBe("GET");
    expect(metadata.route).toBe("/api/test");
    expect(metadata.statusCode).toBe(200);
  });

  it("hashes userId and does not include the raw value", () => {
    const rawId = "user-abc-123-secret";
    logRequest(makeEntry({ userId: rawId }));

    const parsed = parsedLog(consoleSpy);
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(metadata.userId).toBeUndefined();
    expect(metadata.userIdHash).toBeDefined();
    expect(metadata.userIdHash).not.toBe(rawId);
    expect(metadata.userIdHash).toBe(hashUserId(rawId));
  });

  it("does not include request body PII fields in output", () => {
    logRequest(makeEntry({ method: "POST" }));

    const parsed = parsedLog(consoleSpy);
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(metadata).not.toHaveProperty("body");
    expect(metadata).not.toHaveProperty("email");
    expect(metadata).not.toHaveProperty("password");
    expect(metadata).not.toHaveProperty("submissionContent");
    expect(metadata).not.toHaveProperty("token");
  });

  it("captures statusCode and durationMs", () => {
    logRequest(makeEntry({ statusCode: 422, durationMs: 75 }));

    const parsed = parsedLog(consoleSpy);
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(metadata.statusCode).toBe(422);
    expect(metadata.durationMs).toBe(75);
  });

  it("includes optional fields when provided", () => {
    logRequest(makeEntry({ schoolId: "school-1", role: "TEACHER" }));

    const parsed = parsedLog(consoleSpy);
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(metadata.schoolId).toBe("school-1");
    expect(metadata.role).toBe("TEACHER");
  });

  it("omits optional fields when not provided", () => {
    logRequest(makeEntry());

    const parsed = parsedLog(consoleSpy);
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(metadata).not.toHaveProperty("userIdHash");
    expect(metadata).not.toHaveProperty("schoolId");
    expect(metadata).not.toHaveProperty("role");
  });

  it("is silent when LOG_LEVEL=silent", () => {
    process.env.LOG_LEVEL = "silent";
    logRequest(makeEntry());

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

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

describe("withRequestLogging", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    delete process.env.LOG_LEVEL;
    vi.unstubAllEnvs();
  });

  it("logs statusCode and route on success", async () => {
    const handler = async (_req: any) => new Response(null, { status: 200 });
    const wrapped = withRequestLogging("/api/demo", handler);

    await wrapped({ method: "GET" });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const parsed = parsedLog(consoleSpy);
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(metadata.route).toBe("/api/demo");
    expect(metadata.statusCode).toBe(200);
    expect(metadata.method).toBe("GET");
  });

  it("captures durationMs >= 0", async () => {
    const handler = async () => new Response(null, { status: 201 });
    const wrapped = withRequestLogging("/api/demo", handler);

    await wrapped({ method: "POST" });

    const parsed = parsedLog(consoleSpy);
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(typeof metadata.durationMs).toBe("number");
    expect(metadata.durationMs as number).toBeGreaterThanOrEqual(0);
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
    const metadata = parsed.metadata as Record<string, unknown>;
    expect(metadata.statusCode).toBe(403);
  });

  it("is silent when LOG_LEVEL=silent even for wrapped handlers", async () => {
    process.env.LOG_LEVEL = "silent";
    const handler = async () => new Response(null, { status: 200 });
    const wrapped = withRequestLogging("/api/demo", handler);

    await wrapped({ method: "GET" });

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
