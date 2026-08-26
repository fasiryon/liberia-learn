import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindContent = vi.hoisted(() => vi.fn());
const mockFindGovernance = vi.hoisted(() => vi.fn());
const mockFindRevision = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockSign = vi.hoisted(() => vi.fn((payload) => ({
  payload,
  signature: "signed",
  keyId: "test-key",
})));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: "student-1",
    role: "STUDENT",
    schoolId: "school-1",
    isPlatformAdmin: false,
  })),
}));
vi.mock("@vercel/blob", () => ({ head: vi.fn() }));
vi.mock("@/lib/content-availability-manifest.server", () => ({
  signContentAvailability: mockSign,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mockTransaction,
    curriculumContent: { findFirst: mockFindContent },
    curriculumGovernanceEvent: { findFirst: mockFindGovernance },
    curriculumContentRevision: { findFirst: mockFindRevision },
  },
}));

import { GET } from "@/app/api/curriculum/[contentId]/route";

const originalWriterFlag = process.env.P2A_PROVENANCE_WRITERS_DISABLED;

function governedRow(status = "published") {
  return {
    contentId: "lesson-1",
    grade: 6,
    subject: "SCIENCE",
    contentType: "lesson",
    status,
    version: "v2",
    payload: { title: "Water cycle" },
    teacherCreated: false,
    editedBy: null,
    audioAssets: [],
    videoSupplements: [],
    provenance: {
      id: "provenance-1",
      lifecycleState:
        status === "REVOKED" ? "REVOKED" : status === "rejected" ? "REJECTED" : "APPROVED",
      currentRevisionId: "revision-5",
      currentRevision: {
        sequence: 5,
        createdAt: new Date("2026-08-25T10:00:00.000Z"),
      },
    },
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-25T10:00:00.000Z"),
  };
}

describe("P5-A Phase B manifest issuance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "false";
    mockTransaction.mockImplementation(async (callback) => callback({
      curriculumContent: { findFirst: mockFindContent },
      curriculumGovernanceEvent: { findFirst: mockFindGovernance },
      curriculumContentRevision: { findFirst: mockFindRevision },
    }));
    mockFindGovernance.mockImplementation(({ where }) =>
      where.lifecycleResult
        ? Promise.resolve({
            revisionId: "revision-5",
            lifecycleResult: "APPROVED",
            createdAt: new Date("2026-08-25T11:00:00.000Z"),
          })
        : Promise.resolve({
            sequence: 9,
            createdAt: new Date("2026-08-25T11:00:00.000Z"),
          }),
    );
    mockFindRevision.mockResolvedValue({ id: "revision-5", sequence: 5 });
  });
  afterEach(() => {
    if (originalWriterFlag === undefined) delete process.env.P2A_PROVENANCE_WRITERS_DISABLED;
    else process.env.P2A_PROVENANCE_WRITERS_DISABLED = originalWriterFlag;
  });

  it("signs the persisted revision/governance cursor and deterministic state time", async () => {
    mockFindContent.mockResolvedValue(governedRow());

    const response = await GET(new Request("http://localhost/api/curriculum/lesson-1"), {
      params: { contentId: "lesson-1" },
    });
    expect(response.status).toBe(200);
    expect(mockSign).toHaveBeenCalledWith({
      contentId: "lesson-1",
      version: "v2",
      revoked: false,
      issuedAt: "2026-08-25T11:00:00.000Z",
      sequence: { revision: 5, governance: 9 },
    });
  });

  it("allows a revision-only advance by resetting governance to the new revision stream", async () => {
    mockFindContent.mockResolvedValue(governedRow());
    mockFindGovernance.mockImplementation(({ where }) =>
      where.lifecycleResult
        ? Promise.resolve({
            revisionId: "revision-4",
            lifecycleResult: "APPROVED",
            createdAt: new Date("2026-08-25T09:00:00.000Z"),
          })
        : Promise.resolve(null),
    );

    await GET(new Request("http://localhost/api/curriculum/lesson-1"), {
      params: { contentId: "lesson-1" },
    });
    expect(mockSign).toHaveBeenCalledWith(expect.objectContaining({
      sequence: { revision: 5, governance: 0 },
    }));
  });

  it("uses the same authoritative cursor for a governed unavailable state", async () => {
    mockFindContent.mockResolvedValue(governedRow("rejected"));
    mockFindGovernance.mockImplementation(({ where }) =>
      where.lifecycleResult
        ? Promise.resolve({
            revisionId: "revision-5",
            lifecycleResult: "REJECTED",
            createdAt: new Date("2026-08-25T11:00:00.000Z"),
          })
        : Promise.resolve({
            sequence: 9,
            createdAt: new Date("2026-08-25T11:00:00.000Z"),
          }),
    );

    const response = await GET(new Request("http://localhost/api/curriculum/lesson-1"), {
      params: { contentId: "lesson-1" },
    });
    expect(response.status).toBe(404);
    expect(mockSign).toHaveBeenCalledWith(expect.objectContaining({
      contentId: "lesson-1",
      version: null,
      revoked: true,
      sequence: { revision: 5, governance: 9 },
    }));
  });

  it("does not mint an unsequenced trust statement when provenance is unavailable", async () => {
    mockFindContent.mockResolvedValue({ ...governedRow(), provenance: null });

    const response = await GET(new Request("http://localhost/api/curriculum/lesson-1"), {
      params: { contentId: "lesson-1" },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.offlineManifest).toBeNull();
    expect(mockSign).not.toHaveBeenCalled();
  });

  it("does not sign compatibility-mode projections that have no governance event", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    mockFindContent.mockResolvedValue(governedRow());

    const response = await GET(new Request("http://localhost/api/curriculum/lesson-1"), {
      params: { contentId: "lesson-1" },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).offlineManifest).toBeNull();
    expect(mockSign).not.toHaveBeenCalled();
  });

  it("does not sign a regressed revision pointer", async () => {
    mockFindContent.mockResolvedValue(governedRow());
    mockFindRevision.mockResolvedValue({ id: "revision-6", sequence: 6 });

    const response = await GET(new Request("http://localhost/api/curriculum/lesson-1"), {
      params: { contentId: "lesson-1" },
    });
    expect((await response.json()).offlineManifest).toBeNull();
    expect(mockSign).not.toHaveBeenCalled();
  });

  it("does not sign a lifecycle event applied to an older revision after the current revision existed", async () => {
    mockFindContent.mockResolvedValue(governedRow());
    mockFindGovernance.mockImplementation(({ where }) =>
      where.lifecycleResult
        ? Promise.resolve({
            revisionId: "revision-4",
            lifecycleResult: "APPROVED",
            createdAt: new Date("2026-08-25T12:00:00.000Z"),
          })
        : Promise.resolve(null),
    );

    const response = await GET(new Request("http://localhost/api/curriculum/lesson-1"), {
      params: { contentId: "lesson-1" },
    });
    expect((await response.json()).offlineManifest).toBeNull();
    expect(mockSign).not.toHaveBeenCalled();
  });
});
