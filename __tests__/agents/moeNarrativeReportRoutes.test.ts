import { describe, it, expect, vi, beforeEach } from "vitest";

const requireUser = vi.fn();
const isMoePortalEnabled = vi.fn();
const logAudit = vi.fn();
const reportDraftFindMany = vi.fn();
const reportDraftFindUnique = vi.fn();
const runAgent = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: (...a: unknown[]) => requireUser(...a) }));
vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: (...a: unknown[]) => isMoePortalEnabled(...a) }));
vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    reportDraft: {
      findMany: (...a: unknown[]) => reportDraftFindMany(...a),
      findUnique: (...a: unknown[]) => reportDraftFindUnique(...a),
    },
  },
}));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: (...a: unknown[]) => runAgent(...a) }));
vi.mock("@/lib/agents/bootstrap", () => ({}));

import { GET as listGET } from "@/app/api/moe/narrative-reports/route";
import { GET as detailGET } from "@/app/api/moe/narrative-reports/[id]/route";
import { POST as runPOST } from "@/app/api/admin/agents/moe-narrative-report/run/route";

const MOE_USER = { id: "moe-1", role: "MOE_OFFICIAL", isPlatformAdmin: false, schoolId: null };
const PLATFORM_ADMIN = { id: "admin-1", role: "ADMIN", isPlatformAdmin: true, schoolId: null };
const TEACHER = { id: "t-1", role: "TEACHER", isPlatformAdmin: false, schoolId: "s-1" };

function req(url: string, body?: unknown) {
  return new Request(url, {
    method: body ? "POST" : "GET",
    ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  }) as never;
}

function reqWithParams(url: string, id: string) {
  return { req: req(url), ctx: { params: Promise.resolve({ id }) } };
}

beforeEach(() => {
  requireUser.mockReset();
  isMoePortalEnabled.mockReset();
  logAudit.mockReset();
  reportDraftFindMany.mockReset();
  reportDraftFindUnique.mockReset();
  runAgent.mockReset();
  isMoePortalEnabled.mockReturnValue(true);
});

describe("GET /api/moe/narrative-reports", () => {
  it("returns 404 when the MOE portal flag is off", async () => {
    isMoePortalEnabled.mockReturnValue(false);
    const res = await listGET(req("http://x/api/moe/narrative-reports"));
    expect(res.status).toBe(404);
  });

  it("returns 403 for a non-MOE, non-platform-admin caller", async () => {
    requireUser.mockResolvedValue(TEACHER);
    const res = await listGET(req("http://x/api/moe/narrative-reports"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with reports for a MOE official", async () => {
    requireUser.mockResolvedValue(MOE_USER);
    reportDraftFindMany.mockResolvedValue([{ id: "r1", scope: "national", scopeId: null, periodType: "monthly" }]);
    const res = await listGET(req("http://x/api/moe/narrative-reports"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toHaveLength(1);
  });

  it("filters by scope query param when provided", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    reportDraftFindMany.mockResolvedValue([]);
    await listGET(req("http://x/api/moe/narrative-reports?scope=district"));
    expect(reportDraftFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { scope: "district" } }));
  });

  it("logs an audit event on successful list access", async () => {
    requireUser.mockResolvedValue(MOE_USER);
    reportDraftFindMany.mockResolvedValue([]);
    await listGET(req("http://x/api/moe/narrative-reports"));
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "MOE_NARRATIVE_REPORTS_LIST_VIEW" }));
  });
});

describe("GET /api/moe/narrative-reports/[id]", () => {
  it("returns 404 when the MOE portal flag is off", async () => {
    isMoePortalEnabled.mockReturnValue(false);
    const { req: r, ctx } = reqWithParams("http://x/api/moe/narrative-reports/r1", "r1");
    const res = await detailGET(r, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 for a non-MOE, non-platform-admin caller", async () => {
    requireUser.mockResolvedValue(TEACHER);
    const { req: r, ctx } = reqWithParams("http://x/api/moe/narrative-reports/r1", "r1");
    const res = await detailGET(r, ctx);
    expect(res.status).toBe(403);
  });

  it("returns 404 when the report does not exist", async () => {
    requireUser.mockResolvedValue(MOE_USER);
    reportDraftFindUnique.mockResolvedValue(null);
    const { req: r, ctx } = reqWithParams("http://x/api/moe/narrative-reports/ghost", "ghost");
    const res = await detailGET(r, ctx);
    expect(res.status).toBe(404);
  });

  it("returns the full report including narrativeText and dataSnapshot for a MOE official", async () => {
    requireUser.mockResolvedValue(MOE_USER);
    reportDraftFindUnique.mockResolvedValue({
      id: "r1",
      narrativeText: "Report body.",
      dataSnapshot: { enrollment: 100 },
      changesSummary: null,
      status: "DRAFT",
    });
    const { req: r, ctx } = reqWithParams("http://x/api/moe/narrative-reports/r1", "r1");
    const res = await detailGET(r, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.narrativeText).toBe("Report body.");
    expect(body.report.status).toBe("DRAFT");
  });
});

describe("POST /api/admin/agents/moe-narrative-report/run", () => {
  beforeEach(() => {
    runAgent.mockResolvedValue({ status: "SUCCESS", invocationId: "inv-1", response: "ok", toolCalls: [] });
  });

  it("denies a MOE official who is not a platform admin (this trigger is platform-admin only)", async () => {
    requireUser.mockResolvedValue(MOE_USER);
    const res = await runPOST(
      req("http://x/api/admin/agents/moe-narrative-report/run", {
        scope: "national",
        periodType: "monthly",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
      })
    );
    expect(res.status).toBe(403);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("rejects an invalid scope value with 400", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    const res = await runPOST(
      req("http://x/api/admin/agents/moe-narrative-report/run", {
        scope: "planet",
        periodType: "monthly",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
      })
    );
    expect(res.status).toBe(400);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("requires scopeId for district/school scope", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    const res = await runPOST(
      req("http://x/api/admin/agents/moe-narrative-report/run", {
        scope: "district",
        periodType: "monthly",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
      })
    );
    expect(res.status).toBe(400);
  });

  it("runs the agent for a platform admin with valid national scope input", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    const res = await runPOST(
      req("http://x/api/admin/agents/moe-narrative-report/run", {
        scope: "national",
        periodType: "monthly",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
      })
    );
    expect(res.status).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "moe-narrative-report",
      expect.stringContaining("scope: national"),
      expect.objectContaining({ userRole: "system", triggeredBy: "USER" })
    );
  });
});
