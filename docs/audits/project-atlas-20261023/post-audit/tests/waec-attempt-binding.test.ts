import { beforeEach, describe, expect, it, vi } from "vitest";
import { observe } from "./observations";

const mocks = vi.hoisted(() => ({ student: vi.fn(), findItems: vi.fn(), updateMastery: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { id: "synthetic-waec-user" } }) }));
vi.mock("@/lib/auth", () => ({ authOptions: {}, requireRole: async () => ({ id: "synthetic-waec-user", role: "STUDENT", schoolId: "synthetic-school-A" }) }));
vi.mock("@/lib/db", () => ({ prisma: {
  student: { findFirst: mocks.student }, waecPracticeItem: { findMany: mocks.findItems },
} }));
vi.mock("@/lib/mastery/masteryService", () => ({ updateMasteryProfile: mocks.updateMastery }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: vi.fn(() => { throw new Error("No model calls in Atlas verification"); }) }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: vi.fn() }));
import { POST } from "@/app/api/student/waec/[subject]/practice/route";

// This item/key is wholly synthetic; no repository assessment key is read.
const item = { id: "synthetic-waec-item", subjectId: "waec_math", topicId: "math.number_numeration", prompt: "Synthetic unit test item", options: ["synthetic choice"], correctIndex: 0, explanation: "Synthetic fixture only" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.student.mockResolvedValue({ id: "synthetic-waec-student", currentGrade: 11, user: { schoolId: "synthetic-school-A" }, enrollments: [{ Class: { schoolId: "synthetic-school-A" } }] });
  mocks.findItems.mockResolvedValue([item]); mocks.updateMastery.mockResolvedValue(undefined);
});
function submit(answers = [{ id: item.id, chosen: 0 }]) {
  return POST(new Request("http://atlas.invalid/api/student/waec/math/practice", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers }),
  }), { params: { subject: "math" } });
}
describe("AT-R-WAEC synthetic legacy evidence binding", () => {
  it("P1 rejects an unissued practice attempt before admitting mastery", async () => {
    const response = await submit();
    observe("ATLAS-WAEC-UNISSUED", { http: response.status, masteryWrites: mocks.updateMastery.mock.calls.length });
    expect([400, 403, 409]).toContain(response.status);
    expect(mocks.updateMastery).not.toHaveBeenCalled();
  });
  it("P1 replaying the same answers cannot create a second mastery admission", async () => {
    await submit(); await submit();
    observe("ATLAS-WAEC-REPLAY", { masteryWrites: mocks.updateMastery.mock.calls.length });
    expect(mocks.updateMastery.mock.calls.length).toBeLessThanOrEqual(1);
  });
  it("P1 rejects duplicate item identities within one submission", async () => {
    const response = await submit([{ id: item.id, chosen: 0 }, { id: item.id, chosen: 0 }]);
    const result = await response.json();
    observe("ATLAS-WAEC-DUPLICATE", { http: response.status, total: result.total, masteryWrites: mocks.updateMastery.mock.calls.length });
    expect(response.status).toBe(400);
    expect(mocks.updateMastery).not.toHaveBeenCalled();
  });
  it("P1 refuses an item from a different subject", async () => {
    mocks.findItems.mockResolvedValue([{ ...item, subjectId: "waec_english", topicId: "english.comprehension" }]);
    const response = await submit();
    expect([400, 403, 409]).toContain(response.status);
  });
});
