/**
 * AT-R-LAB (Project Atlas, P1): a virtual-lab AI refusal or uncertain moderation must record NO attainment evidence,
 * never a numeric zero; an AI-suggested score is provisional, carries scorer provenance, and is not admitted as
 * learner performance or as the session score before an independent (teacher) review. Student assistance
 * attribution (aiAssistUsed) is a separate fact and stays as it is. Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  routedCompletion: vi.fn(),
  moderateText: vi.fn(async (): Promise<{ verdict: "SAFE" | "UNSAFE" | "UNCERTAIN" }> => ({ verdict: "SAFE" })),
  enqueueEscalation: vi.fn(async () => ({ id: "esc" })),
  recordPerformanceEvent: vi.fn(async () => undefined),
  labSessionUpdate: vi.fn(async ({ data }: any) => ({ id: "synthetic-session", labId: "synthetic-lab", startedAt: new Date(Date.now() - 60_000), completedAt: data.completedAt ?? null, ...data })),
  logAudit: vi.fn(async () => undefined),
}));
vi.mock("@/lib/ai/router", () => ({ routedCompletion: mocks.routedCompletion }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: mocks.moderateText }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mocks.enqueueEscalation }));
vi.mock("@/lib/intelligence/recordPerformanceEvent", () => ({ recordPerformanceEvent: mocks.recordPerformanceEvent }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/serverFlags", () => ({ isVirtualLabsEnabled: () => true }));
vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ id: "synthetic-lab-user", role: "STUDENT", schoolId: "synthetic-school-A" }) }));
vi.mock("@/lib/student/labEligibility", () => ({
  loadAuthorizedPracticalSessions: async () => [{ session: { id: "synthetic-session", labId: "synthetic-lab", startedAt: new Date(Date.now() - 60_000), completedAt: null } }],
  studentSessionSummary: (s: any) => ({ id: s.id, labId: s.labId, startedAt: s.startedAt, completedAt: s.completedAt }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    virtualLab: { findUnique: async () => ({ labId: "synthetic-lab", title: "Plant Growth Lab", subject: "SCIENCE", grade: 7, payload: {} }) },
    student: { findUnique: async () => ({ id: "synthetic-lab-student", currentGrade: 7 }) },
    labSession: { update: mocks.labSessionUpdate },
    $transaction: async (fn: any) => fn({ labSession: { update: mocks.labSessionUpdate } }),
  },
}));

import { analyzeLabSession } from "@/lib/ai/lab/labAnalyzer";
import { POST } from "@/app/api/student/labs/[labId]/session/route";

const lab = { title: "Plant Growth Lab", subject: "SCIENCE", gradeLevel: 7 };
const modelAnalysis = JSON.stringify({ suggestedScore: 84, observationFeedback: "Relevant observations, used evidence well.", conclusionFeedback: "Mostly clear conclusion with one more detail needed.",
  whatWentWell: ["Clear evidence"], areasToImprove: ["Explain more"], connectionToStandard: "Developing evidence-based explanation.", teacherNote: "Review linking measurements to claims." });
const submit = () => POST(new Request("http://localhost/api/student/labs/synthetic-lab/session", { method: "POST", body: JSON.stringify({ observations: { height: 12 }, conclusions: "Plants with more water grew taller." }) }) as any, { params: { labId: "synthetic-lab" } });

beforeEach(() => { vi.clearAllMocks(); mocks.moderateText.mockResolvedValue({ verdict: "SAFE" }); });

describe("AT-R-LAB: lab analyzer outcome", () => {
  for (const verdict of ["UNCERTAIN", "UNSAFE"] as const) {
    it(`${verdict} input moderation withholds the analysis with no score, never zero`, async () => {
      mocks.moderateText.mockResolvedValueOnce({ verdict });
      const result = await analyzeLabSession({ lab, observations: {}, conclusions: "x", gradeLevel: 7 });
      expect(mocks.routedCompletion).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: "WITHHELD", withheldReason: "INPUT_MODERATION", suggestedScore: null, scoreProvenance: null });
    });
  }
  it("a model analysis is a provisional AI suggestion with scorer provenance", async () => {
    mocks.routedCompletion.mockResolvedValueOnce({ content: modelAnalysis, model: "gpt-4o" });
    const result = await analyzeLabSession({ lab, observations: {}, conclusions: "x", gradeLevel: 7 });
    expect(result).toMatchObject({ status: "ANALYZED", suggestedScore: 84, scoreProvenance: { scorer: "AI_MODEL", status: "PROVISIONAL", model: "gpt-4o" } });
  });
});

describe("AT-R-LAB: student lab session route", () => {
  it("an UNCERTAIN refusal records no performance event and no session score", async () => {
    mocks.moderateText.mockResolvedValueOnce({ verdict: "UNCERTAIN" });
    const response = await submit();
    expect(response.status).toBe(200);
    expect(mocks.recordPerformanceEvent).not.toHaveBeenCalled();
    const data = mocks.labSessionUpdate.mock.calls.at(-1)![0].data;
    expect(data.score).toBeNull();
    expect(data.aiAnalysis).toMatchObject({ status: "WITHHELD", suggestedScore: null });
  });
  it("a SAFE AI suggestion is stored as provisional only: no performance event, no session score before teacher review", async () => {
    mocks.routedCompletion.mockResolvedValueOnce({ content: modelAnalysis, model: "gpt-4o" });
    const response = await submit();
    expect(response.status).toBe(200);
    expect(mocks.recordPerformanceEvent).not.toHaveBeenCalled();
    const data = mocks.labSessionUpdate.mock.calls.at(-1)![0].data;
    expect(data.score).toBeNull();
    expect(data.aiAnalysis).toMatchObject({ status: "ANALYZED", suggestedScore: 84, scoreProvenance: { scorer: "AI_MODEL", status: "PROVISIONAL" } });
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ details: expect.objectContaining({ analysisStatus: "ANALYZED", provisionalSuggestedScore: 84 }) }));
  });
});
