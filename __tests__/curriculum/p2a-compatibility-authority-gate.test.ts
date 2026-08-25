import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateProjection = vi.hoisted(() => vi.fn());
const logAuditRequired = vi.hoisted(() => vi.fn());
const logAuditRequiredWithId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/curriculum/mutations/repository", async (original) => {
  const actual = await original<typeof import("@/lib/curriculum/mutations/repository")>();
  return { ...actual, updateCurriculumGovernanceProjection: updateProjection };
});

vi.mock("@/lib/audit", async (original) => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, logAuditRequired, logAuditRequiredWithId };
});

function makeTx(options: { content: { id: string } | null; provenance: { provenanceCompleteness: string } | null }) {
  return {
    curriculumContent: {
      findUnique: vi.fn().mockResolvedValue(options.content),
    },
    curriculumProvenance: {
      findUnique: vi.fn().mockResolvedValue(options.provenance),
    },
  };
}

describe("P2-A compatibility-path automated-approval authority gate", () => {
  beforeEach(() => {
    updateProjection.mockReset().mockResolvedValue(undefined);
    logAuditRequired.mockReset().mockResolvedValue(undefined);
    logAuditRequiredWithId.mockReset().mockResolvedValue("audit-1");
  });
  afterEach(() => {
    delete process.env.P2A_PROVENANCE_WRITERS_DISABLED;
    vi.resetModules();
  });

  async function runWithTx(tx: ReturnType<typeof makeTx>, input: Record<string, unknown>) {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) },
    }));
    const { appendCurriculumGovernanceEventInTransaction } = await import(
      "@/lib/curriculum/mutations/governanceWriter"
    );
    return appendCurriculumGovernanceEventInTransaction(tx as any, input as any);
  }

  it("compatibility mode (writers disabled) blocks AUTOMATED_RISK_POLICY approval when there is no provenance root at all", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    const tx = makeTx({ content: null, provenance: null });
    await expect(
      runWithTx(tx, {
        contentId: "content-legacy-1",
        eventType: "APPROVED",
        actorType: "SYSTEM",
        actorLabel: "risk-policy",
        approvalBasis: "AUTOMATED_RISK_POLICY",
        reviewAuthority: "SYSTEM",
      }),
    ).rejects.toThrow("Automated approval requires VERIFIED provenance");
    expect(updateProjection).not.toHaveBeenCalled();
  });

  it("compatibility mode blocks AUTOMATED_RISK_POLICY approval when provenance exists but is not VERIFIED", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    const tx = makeTx({
      content: { id: "content-row-1" },
      provenance: { provenanceCompleteness: "UNVERIFIED" },
    });
    await expect(
      runWithTx(tx, {
        contentId: "content-1",
        eventType: "APPROVED",
        actorType: "SYSTEM",
        actorLabel: "risk-policy",
        approvalBasis: "AUTOMATED_RISK_POLICY",
        reviewAuthority: "SYSTEM",
      }),
    ).rejects.toThrow("Automated approval requires VERIFIED provenance");
    expect(updateProjection).not.toHaveBeenCalled();
  });

  it("compatibility mode allows AUTOMATED_RISK_POLICY approval when provenance is VERIFIED", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    const tx = makeTx({
      content: { id: "content-row-1" },
      provenance: { provenanceCompleteness: "VERIFIED" },
    });
    const result = await runWithTx(tx, {
      contentId: "content-1",
      eventType: "APPROVED",
      actorType: "SYSTEM",
      actorLabel: "risk-policy",
      approvalBasis: "AUTOMATED_RISK_POLICY",
      reviewAuthority: "SYSTEM",
    });
    expect(result).toBeNull();
    expect(updateProjection).toHaveBeenCalledTimes(1);
  });

  it("compatibility mode blocks ROLE_POLICY approval the same way as AUTOMATED_RISK_POLICY", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    const tx = makeTx({ content: { id: "content-row-1" }, provenance: { provenanceCompleteness: "UNVERIFIED" } });
    await expect(
      runWithTx(tx, {
        contentId: "content-1",
        eventType: "APPROVED",
        actorType: "USER",
        actorUserId: "user-1",
        approvalBasis: "ROLE_POLICY",
        reviewAuthority: "SCHOOL",
        reviewerQualificationRef: "role:ADMIN",
        reviewerQualificationSnapshot: { role: "ADMIN" },
      }),
    ).rejects.toThrow("Automated approval requires VERIFIED provenance");
  });

  it("compatibility mode still mirrors non-automated events (e.g. SUBMITTED) without requiring a provenance lookup", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    const tx = makeTx({ content: null, provenance: null });
    const result = await runWithTx(tx, {
      contentId: "content-1",
      eventType: "SUBMITTED",
      actorType: "USER",
      actorUserId: "user-1",
    });
    expect(result).toBeNull();
    expect(tx.curriculumContent.findUnique).not.toHaveBeenCalled();
    expect(updateProjection).toHaveBeenCalledTimes(1);
  });

  it("compatibility mode still mirrors HUMAN_REVIEW approvals without the automated-approval gate", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    const tx = makeTx({ content: null, provenance: null });
    const result = await runWithTx(tx, {
      contentId: "content-1",
      eventType: "APPROVED",
      actorType: "USER",
      actorUserId: "user-1",
      approvalBasis: "HUMAN_REVIEW",
      reviewAuthority: "SCHOOL",
      reviewerQualificationRef: "p2b-decision:1",
      reviewerQualificationSnapshot: { role: "TEACHER" },
    });
    expect(result).toBeNull();
    expect(tx.curriculumContent.findUnique).not.toHaveBeenCalled();
    expect(updateProjection).toHaveBeenCalledTimes(1);
  });

  it("canonical mode blocks the same invalid automated authority before governance or projection mutation", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "false";
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      curriculumContent: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "content-row-1", contentId: "content-1" }),
      },
      curriculumProvenance: {
        findUnique: vi.fn().mockResolvedValue({
          id: "provenance-1",
          currentRevisionId: "revision-1",
          currentRevision: { id: "revision-1" },
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "provenance-1",
          currentRevisionId: "revision-1",
          provenanceCompleteness: "UNVERIFIED",
          currentRevision: { id: "revision-1" },
        }),
      },
      curriculumContentRevision: {
        findFirst: vi.fn().mockResolvedValue({ id: "revision-1", provenanceId: "provenance-1" }),
      },
    };
    await expect(runWithTx(tx as any, {
      contentId: "content-1",
      eventType: "APPROVED",
      actorType: "SYSTEM",
      actorLabel: "risk-policy",
      approvalBasis: "AUTOMATED_RISK_POLICY",
      reviewAuthority: "SYSTEM",
    })).rejects.toThrow("Automated approval requires VERIFIED provenance");
    expect(logAuditRequiredWithId).not.toHaveBeenCalled();
    expect(updateProjection).not.toHaveBeenCalled();
  });

  it("propagates compatibility audit failure from the same transaction after projection mutation", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    logAuditRequired.mockRejectedValueOnce(new Error("controlled audit failure"));
    const tx = makeTx({
      content: { id: "content-row-1" },
      provenance: { provenanceCompleteness: "VERIFIED" },
    });
    await expect(runWithTx(tx, {
      contentId: "content-1",
      eventType: "APPROVED",
      actorType: "SYSTEM",
      actorLabel: "risk-policy",
      approvalBasis: "AUTOMATED_RISK_POLICY",
      reviewAuthority: "SYSTEM",
    })).rejects.toThrow("controlled audit failure");
    expect(updateProjection).toHaveBeenCalledTimes(1);
    expect(logAuditRequired).toHaveBeenCalledWith(expect.any(Object), tx);
  });
});
