import { describe, expect, it, vi } from "vitest";

const mockRedirect = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

describe("/admin/audit-log compatibility route", () => {
  it("redirects to the existing admin audit page", async () => {
    const { default: AdminAuditLogAliasPage } = await import("@/app/admin/audit-log/page");

    expect(() => AdminAuditLogAliasPage()).toThrow("NEXT_REDIRECT:/admin/audit");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/audit");
  });
});
