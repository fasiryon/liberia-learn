import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { observe } from "./observations";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), findMany: vi.fn(), count: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({ prisma: {
  agentInvocation: { findMany: mocks.findMany, count: mocks.count },
} }));
// Keep the real permission map/assertPermission: mocking it would hide SEC-R01.
import { GET } from "@/app/api/admin/agents/invocations/route";

const schoolAdmin = { id: "synthetic-admin-A", role: "ADMIN", schoolId: "synthetic-school-A", isPlatformAdmin: false };
const rows = [
  { id: "synthetic-inv-A", userId: "synthetic-learner-A", input: { text: "SYNTHETIC_A_ONLY" }, output: {}, toolCalls: [] },
  { id: "synthetic-inv-B", userId: "synthetic-learner-B", input: { text: "SYNTHETIC_B_PRIVATE" }, output: { text: "SYNTHETIC_B_REPLY" }, toolCalls: [{ result: "SYNTHETIC_B_TOOL" }] },
];
type Query = { where: { userId?: string }; skip?: number; take?: number };
function select(query: Query) {
  return rows.filter(row => !query.where.userId || row.userId === query.where.userId);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(schoolAdmin);
  mocks.findMany.mockImplementation(async (query: Query) => select(query));
  mocks.count.mockImplementation(async (query: Query) => select(query).length);
});

describe("SEC-R01 synthetic invocation boundary", () => {
  it("P0 denies a school admin before querying global raw invocation logs", async () => {
    const response = await GET(new NextRequest("http://atlas.invalid/api/admin/agents/invocations"));
    const result = await response.json();
    observe("ATLAS-SEC-R01", { status: response.status, total: result.total, returnedIds: result.invocations?.map((row: { id: string }) => row.id), foreignRawMarkerReturned: JSON.stringify(result).includes("SYNTHETIC_B_PRIVATE") });
    expect(response.status).toBe(403);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });
  it("P0 rejects a forged filter targeting another school's learner", async () => {
    const response = await GET(new NextRequest("http://atlas.invalid/api/admin/agents/invocations?userId=synthetic-learner-B"));
    expect(response.status).toBe(403);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("control: still permits the authenticated platform-admin role", async () => {
    mocks.requireUser.mockResolvedValue({ ...schoolAdmin, isPlatformAdmin: true });
    const response = await GET(new NextRequest("http://atlas.invalid/api/admin/agents/invocations"));
    expect(response.status).toBe(200);
    expect((await response.json()).total).toBe(2);
  });
  it("control: denies a student without querying the store", async () => {
    mocks.requireUser.mockResolvedValue({ ...schoolAdmin, role: "STUDENT" });
    const response = await GET(new NextRequest("http://atlas.invalid/api/admin/agents/invocations"));
    expect(response.status).toBe(403);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
