import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Synthetic ORM model only: primary-key uniqueness and serialized transaction
// rollback approximate database behavior. This is not a database concurrency test.
const fixture = vi.hoisted(() => ({
  user: { id: "synthetic-waec-user-A", role: "STUDENT", schoolId: "synthetic-school-A", isPlatformAdmin: false },
  studentId: "synthetic-waec-student-A",
  studentSchool: "synthetic-school-A",
  grade: 11,
  enrolled: true,
  items: [
    { id: "synthetic-issued-item-A", subjectId: "waec_math", topicId: "math.number_numeration", grade: 11, prompt: "Synthetic item A", options: ["A", "B", "C", "D"], correctIndex: 2, explanation: "SYNTHETIC_PRIVATE_EXPLANATION_A" },
    { id: "synthetic-issued-item-B", subjectId: "waec_math", topicId: "math.algebraic_processes", grade: 11, prompt: "Synthetic item B", options: ["A", "B", "C", "D"], correctIndex: 1, explanation: "SYNTHETIC_PRIVATE_EXPLANATION_B" },
  ],
  receipts: new Map<string, Record<string, unknown>>(),
  failNextCommit: false,
}));
const mocks = vi.hoisted(() => ({ build: vi.fn(), mastery: vi.fn(), assessmentWrites: vi.fn(), transaction: vi.fn(), create: vi.fn(), findItems: vi.fn() }));

function studentRecord() {
  return {
    id: fixture.studentId, userId: fixture.user.id, currentGrade: fixture.grade,
    user: { id: fixture.user.id, role: "STUDENT", schoolId: fixture.studentSchool },
    // Historical first enrollment must not become this attempt's tenant.
    enrollments: fixture.enrolled ? [
      { classId: "synthetic-historical-class", Class: { schoolId: "synthetic-old-school" } },
      { classId: "synthetic-current-class", Class: { schoolId: fixture.studentSchool } },
    ] : [],
  };
}
vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: fixture.user }) }));
vi.mock("@/lib/auth", () => ({
  authOptions: {}, requireUser: async () => fixture.user, requireRole: async () => fixture.user,
}));
vi.mock("@/lib/db", () => ({ prisma: {
  student: { findFirst: async () => studentRecord(), findUnique: async () => studentRecord() },
  user: { findUnique: async () => fixture.user },
  waecPracticeItem: { findMany: mocks.findItems },
  auditLog: {
    create: mocks.create,
    findUnique: async ({ where }: { where: { id: string } }) => fixture.receipts.get(where.id) ?? null,
  },
  assessmentAttempt: { create: mocks.assessmentWrites },
  $transaction: mocks.transaction,
} }));
vi.mock("@/lib/mastery/masteryService", () => ({ updateMasteryProfile: mocks.mastery }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: () => { throw new Error("Synthetic WAEC tests prohibit provider calls"); } }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: vi.fn() }));
vi.mock("@/lib/waec/practice", async () => {
  const actual = await vi.importActual<typeof import("@/lib/waec/practice")>("@/lib/waec/practice");
  return { ...actual, buildPracticeSession: mocks.build };
});
import { GET, POST } from "@/app/api/student/waec/[subject]/practice/route";

type ReceiptCreate = { data: Record<string, unknown> };
type TransactionClient = {
  auditLog: {
    create: (query: ReceiptCreate) => Promise<Record<string, unknown>>;
    findUnique: (query: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
  };
};
function putReceipt(target: Map<string, Record<string, unknown>>, query: ReceiptCreate) {
  const id = query.data.id;
  if (typeof id !== "string" || id.length === 0) throw new Error("Synthetic receipt requires a server-issued id");
  if (target.has(id)) throw Object.assign(new Error("Synthetic duplicate receipt"), { code: "P2002", meta: { target: ["id"] } });
  const receipt = { ...query.data }; target.set(id, receipt); return receipt;
}
let transactionTail: Promise<void> = Promise.resolve();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "synthetic-waec-test-secret-with-at-least-thirty-two-bytes");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T10:00:00.000Z"));
  fixture.user = { id: "synthetic-waec-user-A", role: "STUDENT", schoolId: "synthetic-school-A", isPlatformAdmin: false };
  fixture.studentId = "synthetic-waec-student-A";
  fixture.studentSchool = "synthetic-school-A"; fixture.grade = 11;
  fixture.enrolled = true;
  fixture.items = [
    { id: "synthetic-issued-item-A", subjectId: "waec_math", topicId: "math.number_numeration", grade: 11, prompt: "Synthetic item A", options: ["A", "B", "C", "D"], correctIndex: 2, explanation: "SYNTHETIC_PRIVATE_EXPLANATION_A" },
    { id: "synthetic-issued-item-B", subjectId: "waec_math", topicId: "math.algebraic_processes", grade: 11, prompt: "Synthetic item B", options: ["A", "B", "C", "D"], correctIndex: 1, explanation: "SYNTHETIC_PRIVATE_EXPLANATION_B" },
  ];
  fixture.receipts = new Map(); fixture.failNextCommit = false; transactionTail = Promise.resolve();
  mocks.build.mockImplementation(async () => ({
    subjectId: "waec_math", subjectName: "Mathematics",
    questions: fixture.items.map(({ id, topicId, prompt, options }) => ({ id, topicId, topicName: "Synthetic topic", prompt, options })),
  }));
  mocks.findItems.mockImplementation(async (query: { where?: { id?: { in?: string[] }; subjectId?: string; grade?: number } }) => {
    const where = query.where ?? {};
    return fixture.items.filter(item => (!where.id?.in || where.id.in.includes(item.id)) &&
      (!where.subjectId || item.subjectId === where.subjectId) && (where.grade === undefined || item.grade === where.grade));
  });
  mocks.mastery.mockResolvedValue(undefined);
  mocks.create.mockImplementation(async (query: ReceiptCreate) => {
    if (fixture.failNextCommit) {
      fixture.failNextCommit = false;
      throw Object.assign(new Error("Synthetic atomic commit failed"), { code: "P2028" });
    }
    return putReceipt(fixture.receipts, query);
  });
  mocks.transaction.mockImplementation(async (operation: (tx: TransactionClient) => Promise<unknown>) => {
    const previous = transactionTail;
    let unlock = () => {};
    transactionTail = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    const pending = new Map(fixture.receipts);
    try {
      const result = await operation({ auditLog: {
        create: async query => putReceipt(pending, query),
        findUnique: async ({ where }) => pending.get(where.id) ?? null,
      } });
      if (fixture.failNextCommit) {
        fixture.failNextCommit = false;
        throw Object.assign(new Error("Synthetic transaction commit failed"), { code: "P2028" });
      }
      fixture.receipts = pending; return result;
    } finally { unlock(); }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

const context = { params: { subject: "math" } };
function answers() { return fixture.items.map(item => ({ id: item.id, chosen: item.correctIndex })); }
function submit(cookie: string, submitted: unknown = answers(), subject = "math") {
  return POST(new NextRequest(`http://atlas.invalid/api/student/waec/${subject}/practice`, {
    method: "POST", headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ answers: submitted }),
  }), { params: { subject } });
}
async function issue() {
  const response = await GET(new NextRequest("http://atlas.invalid/api/student/waec/math/practice"), context);
  expect(response.status).toBe(200);
  const header = response.headers.get("set-cookie");
  expect(header, "successful issuance must bind this browser to a server-issued attempt").not.toBeNull();
  return { response, header: header ?? "", cookie: (header ?? "").split(";")[0] };
}
function expectNoPersistentEffects() {
  expect(fixture.receipts.size).toBe(0); expect(mocks.mastery).not.toHaveBeenCalled(); expect(mocks.assessmentWrites).not.toHaveBeenCalled();
}

describe("AT-R-WAEC real issued-session route contract", () => {
  it("honest GET cookie to POST scores once with a provisional receipt and no mastery admission", async () => {
    const issued = await issue();
    expect(issued.header).toMatch(/HttpOnly/i);
    expect(issued.header).toMatch(/SameSite=Lax/i);
    expect(issued.header).toContain("Path=/api/student/waec/math/practice");
    const questions = await issued.response.json();
    expect(questions.questions).toHaveLength(2);
    expect(JSON.stringify(questions)).not.toMatch(/correctIndex|PRIVATE_EXPLANATION/);
    const token = issued.cookie.slice(issued.cookie.indexOf("=") + 1);
    for (const segment of decodeURIComponent(token).split(".")) {
      expect(Buffer.from(segment, "base64url").toString("utf8")).not.toMatch(/correctIndex|PRIVATE_EXPLANATION/);
    }
    const response = await submit(issued.cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ score: 100, correct: 2, total: 2, evidenceStatus: "PROVISIONAL_UNBOUND", masteryUpdated: false });
    expect(fixture.receipts.size).toBe(1);
    const receipt = [...fixture.receipts.values()][0];
    expect(receipt).toMatchObject({ userId: fixture.user.id, schoolId: "synthetic-school-A", action: "waec.practice.provisional.scored", resourceType: "WAECPracticeAttempt" });
    expect(receipt.details).toMatchObject({ studentId: fixture.studentId, userId: fixture.user.id, schoolId: "synthetic-school-A", subject: "waec_math", grade: 11, score: 100, evidenceStatus: "PROVISIONAL_UNBOUND", masteryUpdated: false, independentAssessment: false, assistance: { status: "UNKNOWN" } });
    expect(JSON.stringify(receipt.details)).not.toMatch(/correctIndex|PRIVATE_EXPLANATION/);
    expect(mocks.mastery).not.toHaveBeenCalled();
    expect(mocks.assessmentWrites).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   "])("missing or blank server secret cannot issue a token: %s", async secret => {
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    const response = await GET(new NextRequest("http://atlas.invalid/api/student/waec/math/practice"), context);
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expectNoPersistentEffects();
  });

  it("missing cookie is rejected for an otherwise valid authenticated student", async () => {
    const response = await submit("");
    expect(response.status).toBe(400); expectNoPersistentEffects();
  });
  it("tampered cookie is rejected before any receipt or mastery write", async () => {
    const { cookie } = await issue();
    const at = cookie.indexOf("=") + 1 + Math.floor((cookie.length - cookie.indexOf("=") - 1) / 2);
    const tampered = cookie.slice(0, at) + (cookie[at] === "A" ? "B" : "A") + cookie.slice(at + 1);
    expect((await submit(tampered)).status).toBe(400); expectNoPersistentEffects();
  });
  it("expired cookie is rejected", async () => {
    const { cookie } = await issue();
    vi.setSystemTime(new Date("2026-10-25T10:00:00.000Z"));
    expect((await submit(cookie)).status).toBe(400); expectNoPersistentEffects();
  });
  it.each(["user", "student", "school", "grade", "subject"])("issued context cannot be replaced: %s", async changed => {
    const { cookie } = await issue();
    if (changed === "user") fixture.user.id = "synthetic-other-user";
    if (changed === "student") fixture.studentId = "synthetic-other-student";
    if (changed === "school") { fixture.studentSchool = "synthetic-school-B"; fixture.user.schoolId = "synthetic-school-B"; }
    if (changed === "grade") fixture.grade = 12;
    const response = await submit(cookie, answers(), changed === "subject" ? "english" : "math");
    expect([400, 403, 409]).toContain(response.status); expectNoPersistentEffects();
  });
  it("duplicate submitted item identities are rejected rather than counted twice", async () => {
    const { cookie } = await issue();
    const response = await submit(cookie, [answers()[0], answers()[0]]);
    expect(response.status).toBe(400); expectNoPersistentEffects();
  });
  it("unissued item identities are rejected", async () => {
    const { cookie } = await issue();
    const response = await submit(cookie, [answers()[0], { id: "synthetic-unissued-item", chosen: 0 }]);
    expect(response.status).toBe(400); expectNoPersistentEffects();
  });
  it("cross-subject or edited bank rows cannot be scored against a prior issuance", async () => {
    const { cookie } = await issue();
    fixture.items[1].subjectId = "waec_english";
    const response = await submit(cookie);
    expect([400, 409]).toContain(response.status); expectNoPersistentEffects();
  });
  it("grading-content revision change invalidates the issued fingerprint", async () => {
    const { cookie } = await issue();
    fixture.items[0].correctIndex = 1;
    const response = await submit(cookie);
    expect([400, 409]).toContain(response.status); expectNoPersistentEffects();
  });
  it("a successful issued attempt cannot be replayed after answer review", async () => {
    const { cookie } = await issue();
    expect((await submit(cookie)).status).toBe(200);
    expect((await submit(cookie)).status).toBe(409);
    expect(fixture.receipts.size).toBe(1); expect(mocks.mastery).not.toHaveBeenCalled();
  });
  it("concurrent submissions have exactly one receipt and one success", async () => {
    const { cookie } = await issue();
    const responses = await Promise.all([submit(cookie), submit(cookie)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(fixture.receipts.size).toBe(1); expect(mocks.mastery).not.toHaveBeenCalled();
  });
  it("atomic commit failure leaves no receipt and the issued attempt can retry", async () => {
    const { cookie } = await issue();
    fixture.failNextCommit = true;
    const failed = await submit(cookie);
    expect([500, 503]).toContain(failed.status);
    expectNoPersistentEffects();
    expect((await submit(cookie)).status).toBe(200);
    expect(fixture.receipts.size).toBe(1); expect(mocks.mastery).not.toHaveBeenCalled();
  });
  it("issuance projects the same validated bank revision that the token signs", async () => {
    mocks.build.mockImplementation(async () => {
      const questions = fixture.items.map(({ id, topicId, prompt, options }) => ({ id, topicId, topicName: "Synthetic", prompt, options }));
      fixture.items[0].prompt = "Synthetic revision arriving during issuance";
      fixture.items[0].correctIndex = 0;
      return { subjectId: "waec_math", subjectName: "Math", questions };
    });
    const { cookie, response } = await issue();
    expect((await response.json()).questions[0].prompt).toBe(fixture.items[0].prompt);
    expect((await submit(cookie)).status).toBe(200); expect(mocks.assessmentWrites).not.toHaveBeenCalled();
  });
  it.each([-1, 4, "2", true])("malformed chosen value is rejected: %s", async chosen => {
    const { cookie } = await issue();
    expect((await submit(cookie, [{ id: fixture.items[0].id, chosen }, answers()[1]])).status).toBe(400); expectNoPersistentEffects();
  });
  it("an unanswered issued item remains valid and scores honestly", async () => {
    const { cookie } = await issue();
    const response = await submit(cookie, [{ id: fixture.items[0].id, chosen: null }, answers()[1]]);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ score: 50, correct: 1, total: 2, masteryUpdated: false });
    expect(mocks.assessmentWrites).not.toHaveBeenCalled(); expect(mocks.mastery).not.toHaveBeenCalled();
  });
  it("missing issued items are rejected", async () => {
    const { cookie } = await issue();
    expect((await submit(cookie, answers().slice(0, 1))).status).toBe(400); expectNoPersistentEffects();
  });
  it("a student without current enrollment cannot receive an issued attempt", async () => {
    fixture.enrolled = false;
    const response = await GET(new NextRequest("http://atlas.invalid/api/student/waec/math/practice"), context);
    expect(response.status).toBe(403); expect(response.headers.get("set-cookie")).toBeNull(); expectNoPersistentEffects();
  });
});
