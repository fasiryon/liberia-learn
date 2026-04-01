import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

describe("handleApiError", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

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

  it("returns 422 for ZodError", async () => {
    const err = { name: "ZodError", issues: [{ message: "Required", path: ["subject"] }] };
    const res = handleApiError(err);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBe("Validation failed");
  });

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

  it("returns 500 for unknown Error without stack trace in response", async () => {
    const res = handleApiError(new Error("Something exploded internally"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.error).toBe("Internal server error");
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

  it("response body never contains raw PII fields", async () => {
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

  it("logs structured error output server-side", async () => {
    await handleApiError(new Error("internal db failure"));

    expect(errorSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(payload.message).toBe("API handler error");
    expect(payload.metadata.errorMessage).toBe("internal db failure");
    expect(payload.metadata.status).toBe(500);
  });

  it("logs Prisma error message server-side", async () => {
    await handleApiError({ code: "P2002", message: "Unique constraint failed" });

    expect(errorSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(payload.message).toBe("API handler error");
    expect(payload.metadata.errorMessage).toBe("Unique constraint failed");
  });

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
