import { describe, expect, it } from "vitest";
import { resolveAppRedirect } from "@/lib/appHub";

describe("app hub redirects", () => {
  it("routes student to /dashboard", () => {
    expect(
      resolveAppRedirect({
        id: "s1",
        role: "STUDENT",
        isPlatformAdmin: false,
        schoolId: "school-1",
      } as any)
    ).toBe("/dashboard");
  });

  it("routes teacher to /teacher", () => {
    expect(
      resolveAppRedirect({
        id: "t1",
        role: "TEACHER",
        isPlatformAdmin: false,
      } as any)
    ).toBe("/teacher");
  });

  it("routes admin to /admin", () => {
    expect(
      resolveAppRedirect({
        id: "a1",
        role: "ADMIN",
        isPlatformAdmin: false,
      } as any)
    ).toBe("/admin");
  });

  it("routes guardian to /guardian", () => {
    expect(
      resolveAppRedirect({
        id: "g1",
        role: "GUARDIAN",
        isPlatformAdmin: false,
      } as any)
    ).toBe("/guardian");
  });

  it("routes platform admin to /platform", () => {
    expect(
      resolveAppRedirect({
        id: "p1",
        role: "ADMIN",
        isPlatformAdmin: true,
      } as any)
    ).toBe("/platform");
  });

  it("routes district admin to /platform", () => {
    expect(
      resolveAppRedirect({
        id: "d1",
        role: "DISTRICT_ADMIN",
        isPlatformAdmin: false,
      } as any)
    ).toBe("/platform");
  });
});
