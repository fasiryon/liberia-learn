import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("handleApiError", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Allow server-side logging in tests by temporarily acting as production
    vi.stubEnv("NODE_ENV", "production");
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  // ── Prisma errors ───────────────────────────────────────────────────────────

  it("returns 409 for Prisma P2002 (unique constraint)", async () => {
    const err = { code: "P2002", message: "Unique constraint failed on field email" };
    const res = handleApiError(err);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toBe("Resource already exists");
    expect(body.timestamp).toBeDefined();
  });

  it("returns 404 for Prisma P2025 (record not found)", async () => {
    const err = { code: "P2025", message: "Record does not exist" };
    const res = handleApiError(err);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 400 for Prisma P2003 (foreign key constraint)", async () => {
    const err = { code: "P2003", message: "Foreign key constraint failed on field" };
    const res = handleApiError(err);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
  });

  // ── ZodError ────────────────────────────────────────────────────────────────

  it("returns 422 for ZodError", async () => {
    const err = { name: "ZodError", issues: [{ message: "Required", path: ["subject"] }] };
    const res = handleApiError(err);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBe("Validation failed");
  });

  // ── Auth errors ─────────────────────────────────────────────────────────────

  it("returns 401 for auth error with status 401", async () => {
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    const res = handleApiError(err);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 for auth error with status 403", async () => {
    const err = Object.assign(new Error("Forbidden"), { status: 403 });
    const res = handleApiError(err);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN");
    expect(body.error).toBe("Forbidden");
  });

  // ── Unknown errors ──────────────────────────────────────────────────────────

  it("returns 500 for unknown Error without stack trace in response", async () => {
    const res = handleApiError(new Error("Something exploded internally"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.error).toBe("Internal server error");
    // Stack trace must NOT appear in the HTTP response
    expect(JSON.stringify(body)).not.toContain("stack");
    expect(JSON.stringify(body)).not.toContain("exploded");
  });

  it("returns 500 for plain string error", async () => {
    const res = handleApiError("some unexpected string");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 for null/undefined", async () => {
    const res = handleApiError(null);
    expect(res.status).toBe(500);
  });

  // ── PII safety ──────────────────────────────────────────────────────────────

  it("response body never contains raw PII fields", async () => {
    // Even if the original error message contains user data, it must not appear
    // in the 500 response (which uses the opaque "Internal server error" message).
    const err = new Error("DB error near email='teacher@school.lr'");
    const res = handleApiError(err);
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("teacher@school.lr");
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("studentId");
    expect(body).not.toHaveProperty("submissionContent");
  });

  // ── Server-side logging ─────────────────────────────────────────────────────

  it("logs error message server-side", async () => {
    await handleApiError(new Error("internal db failure"));
    expect(errorSpy).toHaveBeenCalledWith("[API_ERROR]", "internal db failure");
  });

  it("logs Prisma error message server-side", async () => {
    await handleApiError({ code: "P2002", message: "Unique constraint failed" });
    expect(errorSpy).toHaveBeenCalledWith("[API_ERROR]", "Unique constraint failed");
  });

  // ── Response shape ──────────────────────────────────────────────────────────

  it("response always includes timestamp as ISO string", async () => {
    const res = handleApiError(new Error("oops"));
    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it("response always includes error and code fields", async () => {
    const res = handleApiError({ code: "P2025", message: "not found" });
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(typeof body.code).toBe("string");
    expect(typeof body.timestamp).toBe("string");
  });
});
