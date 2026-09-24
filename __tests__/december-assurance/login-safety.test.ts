/**
 * December assurance — login redirect and login rate-limit keying.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { isSafeInternalPath } from "@/lib/auth/safeRedirect";
import { resolveCredentialIdentifier } from "@/lib/auth";

describe("post-login destinations stay on this origin", () => {
  it.each([
    "//evil.example/phish",
    "/\\evil.example/phish",
    "/\t/evil.example",
    "/\n/evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ])("rejects %j", (value) => {
    expect(isSafeInternalPath(value as string | null | undefined)).toBe(false);
  });

  it.each(["/teacher/dashboard", "/student/today?tab=1", "/guardian/student/abc#top"])("accepts %s", (value) => {
    expect(isSafeInternalPath(value)).toBe(true);
  });

  it("login ignores a protocol-relative ?next= and uses the role home", async () => {
    vi.doMock("next-auth/react", () => ({ signIn: vi.fn(), getSession: vi.fn() }));
    vi.doMock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
    const { resolvePostLoginDestination } = await import("@/app/login/LoginClient");
    const destination = resolvePostLoginDestination({ role: "TEACHER", nextUrl: "//evil.example/phish" });
    expect(destination.startsWith("//")).toBe(false);
    expect(destination.startsWith("/")).toBe(true);
    expect(resolvePostLoginDestination({ role: "TEACHER", nextUrl: "/teacher/homework" })).toBe("/teacher/homework");
  });
});

describe("credential rate-limit keys are per account", () => {
  it("gives different email accounts different keys", () => {
    const a = resolveCredentialIdentifier({ email: "teacher.a@school.lr", password: "x", studentId: "", phone: "" });
    const b = resolveCredentialIdentifier({ email: "teacher.b@school.lr", password: "x", studentId: "", phone: "" });
    expect(a).not.toBe("");
    expect(a).not.toBe(b);
  });

  it("keys student-ID logins by student ID", () => {
    const a = resolveCredentialIdentifier({ email: "", password: "x", studentId: "lbr-2024-001", phone: "" });
    const b = resolveCredentialIdentifier({ email: "", password: "x", studentId: "lbr-2024-002", phone: "" });
    expect(a).toBe("LBR-2024-001");
    expect(a).not.toBe(b);
  });

  it("falls back to a fixed key only when no identifier is present", () => {
    expect(resolveCredentialIdentifier({ email: "", password: "x", studentId: "", phone: "" })).toBe("missing");
  });
});
