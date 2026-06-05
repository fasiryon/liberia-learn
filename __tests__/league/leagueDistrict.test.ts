import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/league/weeklyScore", () => ({
  currentWeekWindow: () => ({
    weekStart: new Date("2026-06-02T00:00:00Z"),
    weekEnd: new Date("2026-06-09T00:00:00Z"),
  }),
  previousWeekWindow: () => ({
    weekStart: new Date("2026-05-26T00:00:00Z"),
    weekEnd: new Date("2026-06-02T00:00:00Z"),
  }),
  computeSchoolWeeklyScores: vi.fn(),
  assignDistrictRanks: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    school: {
      findUnique: vi.fn(),
    },
    leagueWeekSnapshot: {
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/redisCache", () => ({
  withRedisCache: vi.fn((_key: string, _ttl: number, fn: () => unknown) => fn()),
  FALLBACK_LIMIT_EXCEEDED: "FALLBACK_LIMIT_EXCEEDED",
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "sch-1" }),
}));

import { GET as districtGET } from "@/app/api/league/district/route";
import { POST as resetPOST } from "@/app/api/cron/league-weekly-reset/route";
import { computeSchoolWeeklyScores, assignDistrictRanks } from "@/lib/league/weeklyScore";
import { prisma } from "@/lib/db";

const mockComputeScores = computeSchoolWeeklyScores as ReturnType<typeof vi.fn>;
const mockAssignRanks = assignDistrictRanks as ReturnType<typeof vi.fn>;
const mockSchoolFindUnique = prisma.school.findUnique as ReturnType<typeof vi.fn>;
const mockSnapshotUpsert = prisma.leagueWeekSnapshot.upsert as ReturnType<typeof vi.fn>;
const mockSnapshotFindMany = prisma.leagueWeekSnapshot.findMany as ReturnType<typeof vi.fn>;
const mockSnapshotCount = prisma.leagueWeekSnapshot.count as ReturnType<typeof vi.fn>;

const SAMPLE_SCORES = [
  { schoolId: "s1", schoolName: "Alpha Academy", district: "Greater Monrovia", score: 12.5, pointsTotal: 125, enrollmentCount: 10 },
  { schoolId: "s2", schoolName: "Beta High", district: "Greater Monrovia", score: 8.0, pointsTotal: 80, enrollmentCount: 10 },
];
const SAMPLE_RANKED = SAMPLE_SCORES.map((s, i) => ({ ...s, rank: i + 1 }));

beforeEach(() => {
  vi.clearAllMocks();
  mockComputeScores.mockResolvedValue(SAMPLE_SCORES);
  mockAssignRanks.mockReturnValue(SAMPLE_RANKED);
  mockSnapshotUpsert.mockResolvedValue({});
  mockSnapshotFindMany.mockResolvedValue([]);
  mockSnapshotCount.mockResolvedValue(2);
});

describe("GET /api/league/district", () => {
  it("returns district leaderboard when district= param given", async () => {
    const req = new NextRequest("http://test/api/league/district?district=Greater+Monrovia");
    const res = await districtGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.district).toBe("Greater Monrovia");
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows).toHaveLength(2);
  });

  it("returns school rank when schoolId= param given", async () => {
    mockSchoolFindUnique.mockResolvedValue({ district: "Greater Monrovia", name: "Alpha Academy" });
    const req = new NextRequest("http://test/api/league/district?schoolId=s1");
    const res = await districtGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rank).toBe(1);
    expect(body.district).toBe("Greater Monrovia");
    expect(body.total).toBe(2);
  });

  it("returns null rank when school has no district", async () => {
    mockSchoolFindUnique.mockResolvedValue({ district: null, name: "No District School" });
    const req = new NextRequest("http://test/api/league/district?schoolId=s99");
    const res = await districtGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rank).toBeNull();
  });

  it("returns history when history=true and schoolId given", async () => {
    mockSnapshotFindMany.mockResolvedValue([
      { weekStart: "2026-05-26T00:00:00Z", weekEnd: "2026-06-02T00:00:00Z", rank: 1, score: 12, district: "Greater Monrovia" },
    ]);
    const req = new NextRequest("http://test/api/league/district?schoolId=s1&history=true");
    const res = await districtGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history).toHaveLength(1);
    expect(body.history[0].total).toBe(2);
  });

  it("returns 400 when neither district nor schoolId provided", async () => {
    const req = new NextRequest("http://test/api/league/district");
    const res = await districtGET(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/cron/league-weekly-reset", () => {
  const CRON_SECRET = "test-secret";

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("rejects requests without auth", async () => {
    const req = new NextRequest("http://test/api/cron/league-weekly-reset", { method: "POST" });
    const res = await resetPOST(req);
    expect(res.status).toBe(401);
  });

  it("runs reset and returns snapshot count", async () => {
    const req = new NextRequest("http://test/api/cron/league-weekly-reset", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await resetPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots_written).toBe(2);
    expect(mockSnapshotUpsert).toHaveBeenCalledTimes(2);
  });
});
