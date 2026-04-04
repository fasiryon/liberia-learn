import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/serverFlags", () => ({
  isGovCircuitBreakerTripped: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/governance/report", () => ({
  buildGovernanceReport: vi.fn(),
}));

import { GET } from "@/app/api/admin/governance/report/route";
import { requireUser } from "@/lib/auth";
import { isGovCircuitBreakerTripped } from "@/lib/serverFlags";
import { buildGovernanceReport } from "@/lib/governance/report";
import { logAudit } from "@/lib/audit";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/governance/report");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  (isGovCircuitBreakerTripped as any).mockReturnValue(false);
  (buildGovernanceReport as any).mockResolvedValue({
    generatedAt: "2026-04-03T00:00:00.000Z",
    period: "30d",
    from: "2026-03-04T00:00:00.000Z",
    scope: "national",
    schoolId: null,
    overview: {
      auditEvents: 10,
      exportsGenerated: 3,
      aiActions: 5,
      sensitiveActions: 2,
      activeAdmins: 4,
      affectedSchools: 2,
    },
    exportActivity: { total: 3, byType: [], recent: [] },
    adminActions: { total: 8, byAction: [] },
    aiActions: { total: 5, byFeature: [], topSchools: [] },
    sensitiveActionLog: [],
  });
});

describe("GET /api/admin/governance/report", () => {
  it("allows platform admins", async () => {
    (requireUser as any).mockResolvedValue({
      id: "platform-1",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: true,
    });

    const response = await GET(makeRequest({ period: "90d", schoolId: "school-1" }));

    expect(response.status).toBe(200);
    expect(buildGovernanceReport).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "90d",
        schoolId: "school-1",
      })
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "governance.report.viewed",
      })
    );
  });

  it("allows MOE officials without school scope", async () => {
    (requireUser as any).mockResolvedValue({
      id: "moe-1",
      role: "MOE_OFFICIAL",
      schoolId: null,
      isPlatformAdmin: false,
    });

    const response = await GET(makeRequest({ schoolId: "school-1" }));

    expect(response.status).toBe(200);
    expect(buildGovernanceReport).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: null,
      })
    );
  });

  it("rejects unauthorized roles", async () => {
    (requireUser as any).mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
  });

  it("returns 503 when governance is disabled", async () => {
    (isGovCircuitBreakerTripped as any).mockReturnValue(true);
    (requireUser as any).mockResolvedValue({
      id: "platform-1",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: true,
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "governance_disabled" });
  });
});
