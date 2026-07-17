import { describe, it, expect, vi, beforeEach } from "vitest";

const requireUser = vi.fn();
const districtUpdateDraftFindMany = vi.fn();
const districtUpdateDraftFindFirst = vi.fn();
const schoolFindUnique = vi.fn();
const classFindMany = vi.fn();
const runAgent = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: (...a: unknown[]) => requireUser(...a) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    districtUpdateDraft: {
      findMany: (...a: unknown[]) => districtUpdateDraftFindMany(...a),
      findFirst: (...a: unknown[]) => districtUpdateDraftFindFirst(...a),
    },
    school: { findUnique: (...a: unknown[]) => schoolFindUnique(...a) },
    class: { findMany: (...a: unknown[]) => classFindMany(...a) },
  },
}));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: (...a: unknown[]) => runAgent(...a) }));
vi.mock("@/lib/agents/bootstrap", () => ({}));

import { GET as listGET } from "@/app/api/district-updates/route";
import { GET as detailGET } from "@/app/api/district-updates/[id]/route";
import { POST as runPOST } from "@/app/api/admin/agents/district-update/run/route";

const PLATFORM_ADMIN = { id: "admin-1", role: "ADMIN", isPlatformAdmin: true, schoolId: null };
const SCHOOL_ADMIN = { id: "admin-2", role: "ADMIN", isPlatformAdmin: false, schoolId: "school-cha" };
const TEACHER = { id: "t-1", role: "TEACHER", isPlatformAdmin: false, schoolId: "school-cha" };

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
  districtUpdateDraftFindMany.mockReset();
  districtUpdateDraftFindFirst.mockReset();
  schoolFindUnique.mockReset();
  classFindMany.mockReset();
  runAgent.mockReset();
});

describe("GET /api/district-updates", () => {
  it("returns 403 for a non-ADMIN, non-platform-admin caller", async () => {
    requireUser.mockResolvedValue(TEACHER);
    const res = await listGET(req("http://x/api/district-updates"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with updates for a platform admin, no tenant filter applied", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    districtUpdateDraftFindMany.mockResolvedValue([{ id: "u1" }]);
    const res = await listGET(req("http://x/api/district-updates"));
    expect(res.status).toBe(200);
    const where = districtUpdateDraftFindMany.mock.calls[0][0].where;
    expect(where).toEqual({});
  });

  it("scopes a school ADMIN to their own school, their classes, and their district", async () => {
    requireUser.mockResolvedValue(SCHOOL_ADMIN);
    schoolFindUnique.mockResolvedValue({ district: "Montserrado" });
    classFindMany.mockResolvedValue([{ id: "class-1" }, { id: "class-2" }]);
    districtUpdateDraftFindMany.mockResolvedValue([]);

    await listGET(req("http://x/api/district-updates"));

    const where = districtUpdateDraftFindMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { scope: "school", scopeId: "school-cha" },
        { scope: "class", scopeId: { in: ["class-1", "class-2"] } },
        { scope: "district", scopeId: "Montserrado" },
      ])
    );
  });

  it("filters by type query param when provided", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    districtUpdateDraftFindMany.mockResolvedValue([]);
    await listGET(req("http://x/api/district-updates?type=milestone"));
    expect(districtUpdateDraftFindMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ type: "milestone" }));
  });
});

describe("GET /api/district-updates/[id]", () => {
  it("returns 403 for a non-ADMIN caller", async () => {
    requireUser.mockResolvedValue(TEACHER);
    const { req: r, ctx } = reqWithParams("http://x/api/district-updates/u1", "u1");
    const res = await detailGET(r, ctx);
    expect(res.status).toBe(403);
  });

  it("returns 404 when the draft is not found or not visible to this caller", async () => {
    requireUser.mockResolvedValue(SCHOOL_ADMIN);
    schoolFindUnique.mockResolvedValue({ district: "Montserrado" });
    classFindMany.mockResolvedValue([]);
    districtUpdateDraftFindFirst.mockResolvedValue(null);
    const { req: r, ctx } = reqWithParams("http://x/api/district-updates/other-school-draft", "other-school-draft");
    const res = await detailGET(r, ctx);
    expect(res.status).toBe(404);
  });

  it("returns the full draft including draftText and dataSnapshot when visible", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    districtUpdateDraftFindFirst.mockResolvedValue({
      id: "u1",
      draftText: "Great news!",
      dataSnapshot: { enrollment: 100 },
      changesSummary: null,
      status: "DRAFT",
    });
    const { req: r, ctx } = reqWithParams("http://x/api/district-updates/u1", "u1");
    const res = await detailGET(r, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.update.draftText).toBe("Great news!");
    expect(body.update.status).toBe("DRAFT");
  });
});

describe("POST /api/admin/agents/district-update/run", () => {
  beforeEach(() => {
    runAgent.mockResolvedValue({ status: "SUCCESS", invocationId: "inv-1", response: "ok", toolCalls: [] });
  });

  it("denies a school ADMIN who is not a platform admin", async () => {
    requireUser.mockResolvedValue(SCHOOL_ADMIN);
    const res = await runPOST(
      req("http://x/api/admin/agents/district-update/run", { type: "standings", scope: "district", scopeId: "Montserrado", periodType: "weekly" })
    );
    expect(res.status).toBe(403);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("rejects an invalid type value with 400", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    const res = await runPOST(req("http://x/api/admin/agents/district-update/run", { type: "bogus", scopeId: "x" }));
    expect(res.status).toBe(400);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("rejects a standings request with an invalid periodType", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    const res = await runPOST(
      req("http://x/api/admin/agents/district-update/run", { type: "standings", scope: "district", scopeId: "Montserrado", periodType: "yearly" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a milestone request with an invalid scope", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    const res = await runPOST(
      req("http://x/api/admin/agents/district-update/run", { type: "milestone", scope: "district", scopeId: "Montserrado" })
    );
    expect(res.status).toBe(400);
  });

  it("runs the agent with userRole 'system' for a valid standings request", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    const res = await runPOST(
      req("http://x/api/admin/agents/district-update/run", { type: "standings", scope: "district", scopeId: "Montserrado", periodType: "weekly" })
    );
    expect(res.status).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "district-update",
      expect.stringContaining("districtupdate.getLeagueStandings"),
      expect.objectContaining({ userRole: "system", triggeredBy: "USER" })
    );
  });

  it("runs the agent for a valid milestone request", async () => {
    requireUser.mockResolvedValue(PLATFORM_ADMIN);
    const res = await runPOST(
      req("http://x/api/admin/agents/district-update/run", { type: "milestone", scope: "school", scopeId: "s-a" })
    );
    expect(res.status).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "district-update",
      expect.stringContaining("districtupdate.getMilestoneCandidates"),
      expect.objectContaining({ userRole: "system" })
    );
  });
});
