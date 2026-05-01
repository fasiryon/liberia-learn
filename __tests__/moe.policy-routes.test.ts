import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRequireMoeActor = vi.hoisted(() => vi.fn());
const mockCreateMoeDirective = vi.hoisted(() => vi.fn());
const mockListMoeDirectives = vi.hoisted(() => vi.fn());
const mockTransitionMoeDirective = vi.hoisted(() => vi.fn());
const mockPolicyFindMany = vi.hoisted(() => vi.fn());
const mockPolicyCreate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/moe/authority", () => ({ requireMoeActor: mockRequireMoeActor }));
vi.mock("@/lib/moe/policyGovernance", () => ({
  createMoeDirective: mockCreateMoeDirective,
  listMoeDirectives: mockListMoeDirectives,
  transitionMoeDirective: mockTransitionMoeDirective,
}));
vi.mock("@/lib/serverFlags", () => ({
  isMoeGovernanceWorkflowEnabled: () => true,
  isMoePolicyPushEnabled: () => true,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    policyConfig: {
      findMany: mockPolicyFindMany,
      create: mockPolicyCreate,
    },
  },
}));

const moeUser = { id: "moe-1", role: "MOE_OFFICIAL", isPlatformAdmin: false, schoolId: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMoeActor.mockResolvedValue({
    user: moeUser,
    scope: { level: "national", districtId: null, districtName: null, schoolIds: null },
  });
  mockPolicyFindMany.mockResolvedValue([]);
  mockListMoeDirectives.mockResolvedValue([]);
  mockCreateMoeDirective.mockResolvedValue({ id: "directive-1", title: "Policy", status: "draft" });
  mockTransitionMoeDirective.mockResolvedValue({ id: "directive-1", status: "published" });
  mockLogAudit.mockResolvedValue(undefined);
});

describe("MOE policy governance routes", () => {
  it("creates a directive through the existing policies route", async () => {
    const { POST } = await import("@/app/api/moe/policies/route");
    const req = new NextRequest("http://localhost/api/moe/policies", {
      method: "POST",
      body: JSON.stringify({
        title: "National assessment directive",
        description: "Use the approved national assessment policy.",
        policyType: "assessment_policy",
        targetScope: "national",
        targetFilters: {},
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.directive.status).toBe("draft");
    expect(mockCreateMoeDirective).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "moe-1", targetScope: "national" })
    );
  });

  it("denies directive creation when the actor lacks policy control", async () => {
    mockRequireMoeActor.mockResolvedValueOnce({
      user: { id: "district-1", role: "MOE_DISTRICT_ADMIN", isPlatformAdmin: false, schoolId: "school-1" },
      scope: { level: "district", districtId: "district-1", districtName: "District", schoolIds: ["school-1"] },
    });
    const { POST } = await import("@/app/api/moe/policies/route");
    const req = new NextRequest("http://localhost/api/moe/policies", {
      method: "POST",
      body: JSON.stringify({
        title: "National assessment directive",
        description: "Use the approved national assessment policy.",
        policyType: "assessment_policy",
        targetScope: "national",
        targetFilters: {},
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(mockCreateMoeDirective).not.toHaveBeenCalled();
  });

  it("publishes a directive through the transition route", async () => {
    const { PATCH } = await import("@/app/api/moe/policies/[directiveId]/route");
    const req = new NextRequest("http://localhost/api/moe/policies/directive-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "published" }),
    });

    const res = await PATCH(req, { params: { directiveId: "directive-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.directive.status).toBe("published");
    expect(mockTransitionMoeDirective).toHaveBeenCalledWith(
      expect.objectContaining({ directiveId: "directive-1", userId: "moe-1", nextStatus: "published" })
    );
  });
});
