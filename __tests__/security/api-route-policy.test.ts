import { describe, expect, it } from "vitest";
// @ts-ignore JavaScript audit module intentionally runs directly in CI.
import { auditRouteSource } from "@/scripts/audit-api-route-policies.mjs";

const check = (policy: string) => auditRouteSource(`// route-policy: ${policy}\nexport async function GET(){}`);

describe("API route structural policy", () => {
  it("passes protected tenant policy", () => expect(check("auth=session; scope=tenant; authority=school-membership; rationale=school data")).toEqual([]));
  it("fails missing auth", () => expect(auditRouteSource("export async function GET(){}")[0]).toContain("missing"));
  it("fails missing tenant scope", () => expect(check("auth=session; scope=none; authority=role; rationale=protected" )[0]).toContain("requires explicit"));
  it("passes explicit public route", () => expect(check("auth=public; scope=none; authority=public-contract; rationale=health probe")).toEqual([]));
  it("passes provider webhook", () => expect(check("auth=provider; scope=none; authority=hmac; rationale=provider callback")).toEqual([]));
  it("requires elevated authority for national scope", () => {
    expect(check("auth=session; scope=national; authority=moe-role; rationale=national aggregate")[0]).toContain("elevated");
    expect(check("auth=session; scope=national; authority=elevated; rationale=national aggregate")).toEqual([]);
  });
});
