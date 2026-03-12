import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/DemoHints", () => ({
  DemoHints: () => null,
}));

import LoginClient from "@/app/login/LoginClient";
import { getGuardianLoginFields, getStudentLoginFields } from "@/lib/login-identifiers";

describe("login modes", () => {
  it("student mode exposes Student ID and PIN option metadata", () => {
    const emailFields = getStudentLoginFields("email");
    const idFields = getStudentLoginFields("studentId");

    expect(emailFields.identifierLabel).toBe("Email address");
    expect(emailFields.toggleText).toBe("Use Student ID instead");
    expect(idFields.identifierLabel).toBe("Student ID");
    expect(idFields.identifierPlaceholder).toContain("LBR-2024-001");
    expect(idFields.secretLabel).toBe("PIN");
    expect(idFields.toggleText).toBe("Use email instead");
  });

  it("guardian mode exposes phone and PIN option metadata", () => {
    const emailFields = getGuardianLoginFields("email");
    const phoneFields = getGuardianLoginFields("phone");

    expect(emailFields.identifierLabel).toBe("Email address");
    expect(emailFields.toggleText).toBe("Use phone instead");
    expect(phoneFields.identifierLabel).toBe("Phone number");
    expect(phoneFields.identifierPlaceholder).toContain("+231");
    expect(phoneFields.secretLabel).toBe("PIN");
    expect(phoneFields.toggleText).toBe("Use email instead");
  });

  it("login page renders the student toggle by default", () => {
    const html = renderToStaticMarkup(
      <LoginClient showDemoHints={false} demoGroups={[]} demoDefaults={null} />
    );

    expect(html).toContain("Use Student ID instead");
    expect(html).toContain("student@school.lr");
    expect(html).toContain("Continue");
  });
});

