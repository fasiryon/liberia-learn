// __tests__/demo.seed.test.ts
// Verifies that seedChaDemo creates the five expected CHA demo accounts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mock instances so they persist across the module boundary
const mockPrismaInstance = vi.hoisted(() => ({
  school: { upsert: vi.fn(), findUnique: vi.fn() },
  user: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  student: { upsert: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  teacherProfile: { upsert: vi.fn() },
  studentGuardian: { upsert: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  class: { upsert: vi.fn(), findUnique: vi.fn() },
  curriculumContent: { upsert: vi.fn() },
  scheduledWork: { findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  exam: { upsert: vi.fn() },
  examQuestion: { deleteMany: vi.fn(), createMany: vi.fn() },
  certificate: { upsert: vi.fn() },
  learningEvent: { deleteMany: vi.fn(), createMany: vi.fn() },
  assessmentAttempt: { deleteMany: vi.fn(), createMany: vi.fn() },
  enrollment: { findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  placementTest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
  $disconnect: vi.fn(),
}));

// Use a real class so `new PrismaClient()` works (arrow fns can't be constructors)
vi.mock("@prisma/client", () => ({
  Prisma: { JsonNull: null },
  PrismaClient: class {
    school = mockPrismaInstance.school;
    user = mockPrismaInstance.user;
    student = mockPrismaInstance.student;
    teacherProfile = mockPrismaInstance.teacherProfile;
    studentGuardian = mockPrismaInstance.studentGuardian;
    class = mockPrismaInstance.class;
    curriculumContent = mockPrismaInstance.curriculumContent;
    scheduledWork = mockPrismaInstance.scheduledWork;
    exam = mockPrismaInstance.exam;
    examQuestion = mockPrismaInstance.examQuestion;
    certificate = mockPrismaInstance.certificate;
    learningEvent = mockPrismaInstance.learningEvent;
    assessmentAttempt = mockPrismaInstance.assessmentAttempt;
    enrollment = mockPrismaInstance.enrollment;
    placementTest = mockPrismaInstance.placementTest;
    $disconnect = mockPrismaInstance.$disconnect;
    $transaction = mockPrismaInstance.$transaction;
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrismaInstance }));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-pw") },
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    del = vi.fn().mockResolvedValue(1);
  },
}));

import { seedChaDemo, parseChaDemoSeedOptions } from "@/prisma/seeds/cha-demo";
import { loadShowcaseStudentAuthority, loadAuthorizedShowcaseLabs, SHOWCASE_LAB_IDS } from "@/lib/student/showcaseLabs";
import { chaDemoStudentEmail } from "@/lib/demo/chaStudentIdentity";
import bcrypt from "bcryptjs";

const expectedAdminEmail = process.env.E2E_DEMO_ADMIN_EMAIL ?? ["admin", "cha.edu.lr"].join("@");
const expectedTeacherEmail = process.env.E2E_DEMO_TEACHER_EMAIL ?? ["teacher1", "cha.edu.lr"].join("@");
const expectedStudentEmail = process.env.E2E_DEMO_STUDENT_EMAIL ?? ["student1", "cha.edu.lr"].join("@");
const expectedGuardianEmail = process.env.E2E_DEMO_GUARDIAN_EMAIL ?? ["guardian1", "cha.family.lr"].join("@");
const expectedMoeEmail = process.env.E2E_DEMO_MOE_EMAIL ?? ["official1", "moe.gov.lr"].join("@");

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(bcrypt.hash).mockResolvedValue("hashed-pw" as never);
  process.env.DEMO_MOE_PASSWORD = "test-moe-password";
  vi.stubEnv("DEMO_SEED_PASSWORD", "approved-test-demo-password");
  mockPrismaInstance.school.upsert.mockResolvedValue({ id: "school-cha" });
  mockPrismaInstance.school.findUnique.mockResolvedValue({ id: "school-cha", code: "CHA" });
  mockPrismaInstance.class.findUnique.mockResolvedValue({ id: "cha-class-grade9a", schoolId: "school-cha" });
  mockPrismaInstance.user.findUnique.mockResolvedValue(null);
  mockPrismaInstance.$transaction.mockImplementation((callback) => callback(mockPrismaInstance));
  mockPrismaInstance.user.upsert.mockResolvedValue({ id: "mock-user-id" });
  mockPrismaInstance.student.upsert.mockResolvedValue({ id: "mock-student-id", userId: "mock-user-id" });
  mockPrismaInstance.student.findUnique.mockResolvedValue(null);
  mockPrismaInstance.student.create.mockResolvedValue({ id: "mock-student-id" });
  mockPrismaInstance.student.update.mockResolvedValue({ id: "mock-student-id" });
  mockPrismaInstance.teacherProfile.upsert.mockResolvedValue({});
  mockPrismaInstance.studentGuardian.upsert.mockResolvedValue({});
  mockPrismaInstance.studentGuardian.findFirst.mockResolvedValue(null);
  mockPrismaInstance.studentGuardian.create.mockResolvedValue({});
  mockPrismaInstance.class.upsert.mockResolvedValue({ id: "cha-class-grade9a" });
  mockPrismaInstance.curriculumContent.upsert.mockResolvedValue({ id: "cha-demo-content" });
  mockPrismaInstance.scheduledWork.findFirst.mockResolvedValue(null);
  mockPrismaInstance.scheduledWork.create.mockResolvedValue({ id: "cha-scheduled-work" });
  mockPrismaInstance.scheduledWork.upsert.mockResolvedValue({ id: "cha-demo-student1-multimedia-lesson" });
  mockPrismaInstance.exam.upsert.mockResolvedValue({ id: "cha-demo-ratios-exam" });
  mockPrismaInstance.examQuestion.deleteMany.mockResolvedValue({ count: 0 });
  mockPrismaInstance.examQuestion.createMany.mockResolvedValue({ count: 2 });
  mockPrismaInstance.certificate.upsert.mockResolvedValue({ id: "cert-1" });
  mockPrismaInstance.learningEvent.deleteMany.mockResolvedValue({ count: 0 });
  mockPrismaInstance.learningEvent.createMany.mockResolvedValue({ count: 5 });
  mockPrismaInstance.assessmentAttempt.deleteMany.mockResolvedValue({ count: 0 });
  mockPrismaInstance.assessmentAttempt.createMany.mockResolvedValue({ count: 2 });
  mockPrismaInstance.enrollment.findFirst.mockResolvedValue(null);
  mockPrismaInstance.enrollment.create.mockResolvedValue({});
  mockPrismaInstance.enrollment.upsert.mockResolvedValue({});
  mockPrismaInstance.enrollment.deleteMany.mockResolvedValue({ count: 0 });
  mockPrismaInstance.placementTest.findFirst.mockResolvedValue(null);
  mockPrismaInstance.placementTest.create.mockResolvedValue({});
  mockPrismaInstance.placementTest.update.mockResolvedValue({});
});

describe("seedChaDemo", () => {
  it("creates the CHA school record", async () => {
    await seedChaDemo();
    const schoolCall = mockPrismaInstance.school.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.code === "CHA"
    );
    expect(schoolCall).toBeDefined();
    expect(schoolCall![0].create).toMatchObject({
      id: "school-cha",
      code: "CHA",
      name: expect.stringContaining("Cha"),
    });
  });

  it("creates the configured demo admin with ADMIN role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === expectedAdminEmail
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("ADMIN");
  });

  it("creates the configured demo teacher with TEACHER role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === expectedTeacherEmail
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("TEACHER");
  });

  it("creates the configured demo student with STUDENT role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === expectedStudentEmail
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("STUDENT");
  });

  it("creates the configured demo guardian with GUARDIAN role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === expectedGuardianEmail
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("GUARDIAN");
  });

  it("creates the configured demo MOE official with MOE_OFFICIAL role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === expectedMoeEmail
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("MOE_OFFICIAL");
  });
});

/** Stateful persistence fake: execute the real seed and real showcase readers, no hosted DB. */
function staleDemo() {
  const user = { id: "same-student-user", email: chaDemoStudentEmail(), name: "Pewu Gongloe", role: "STUDENT", loginId: "STALE-7", schoolId: "old-school", hashedPwd: "old-hash" };
  const student = { id: "same-student-record", userId: user.id, currentGrade: 7 };
  const placement: any = { id: "same-placement", studentId: student.id, estimatedGrade: 7, band: "G7_9", levelLabel: "Old Grade 7", source: "legacy_client", sessionId: null, decision: null, reviews: [], teacherGrade: 7 };
  let enrollments = [{ studentId: student.id, classId: "old-grade7-class" }, { studentId: "ordinary-student", classId: "ordinary-class" }];
  const ordinary = { id: "ordinary-user", email: "ordinary@example.test", name: "Pewu Gongloe", role: "STUDENT", schoolId: "other-school", loginId: null };
  const users = new Map<string, any>([[user.email, user], [ordinary.email, ordinary]]);
  mockPrismaInstance.user.findUnique.mockImplementation(async ({ where }) => where.loginId
    ? [...users.values()].find((row) => row.loginId === where.loginId) ?? null
    : users.get(where.email) ?? null);
  mockPrismaInstance.user.update.mockImplementation(async ({ where, data }) => {
    expect(where.id).toBe(user.id);
    Object.assign(user, data);
    return user;
  });
  mockPrismaInstance.user.upsert.mockImplementation(async ({ where, create, update }) => {
    const existing = users.get(where.email);
    if (existing) { Object.assign(existing, update); return existing; }
    const created = { id: `seed-${users.size}`, ...create };
    users.set(where.email, created);
    return created;
  });
  mockPrismaInstance.student.findUnique.mockImplementation(async ({ where }) => where.userId === user.id ? { ...student, user: { ...user } } : null);
  mockPrismaInstance.student.upsert.mockImplementation(async ({ where, update }) => {
    expect(where.userId).toBe(user.id);
    Object.assign(student, update);
    return student;
  });
  mockPrismaInstance.student.update.mockImplementation(async ({ data }) => Object.assign(student, data));
  mockPrismaInstance.enrollment.findFirst.mockImplementation(async ({ where }) => enrollments.find((row) => row.studentId === where.studentId && row.classId === where.classId) ?? null);
  mockPrismaInstance.enrollment.deleteMany.mockImplementation(async ({ where }) => {
    const before = enrollments.length;
    enrollments = enrollments.filter((row) => row.studentId !== where.studentId || row.classId === where.classId.not);
    return { count: before - enrollments.length };
  });
  const enroll = async ({ data }: any) => { enrollments.push(data); return data; };
  mockPrismaInstance.enrollment.create.mockImplementation(enroll);
  mockPrismaInstance.enrollment.upsert.mockImplementation(async ({ where, create }) => {
    const key = where.studentId_classId;
    return enrollments.find((row) => row.studentId === key.studentId && row.classId === key.classId) ?? enroll({ data: create });
  });
  mockPrismaInstance.placementTest.findFirst.mockResolvedValue(placement);
  mockPrismaInstance.placementTest.update.mockImplementation(async ({ where, data }) => {
    expect(where.id).toBe(placement.id);
    Object.assign(placement, data);
    return placement;
  });
  mockPrismaInstance.$transaction.mockImplementation(async (callback) => {
    const original = structuredClone({ user, student, placement, enrollments });
    try { return await callback(mockPrismaInstance); }
    catch (error) {
      for (const [target, snapshot] of [[user, original.user], [student, original.student], [placement, original.placement]]) {
        for (const key of Object.keys(target)) delete target[key];
        Object.assign(target, snapshot);
      }
      enrollments = original.enrollments;
      throw error;
    }
  });
  return { user, student, placement, ordinary, users, enrollments: () => enrollments };
}

describe("CHA persisted demo identity repair", () => {
  it("repairs the Grade 7 student1 in place, converges on rerun, and authorizes exactly four showcase labs", async () => {
    const state = staleDemo();
    const ordinaryBefore = { ...state.ordinary };
    expect(await loadShowcaseStudentAuthority(state.user)).toBeNull();
    await seedChaDemo();
    await seedChaDemo();
    expect(state.user).toMatchObject({ id: "same-student-user", email: chaDemoStudentEmail(), name: "Fatu Kollie", role: "STUDENT", schoolId: "school-cha", loginId: "CHA-2026-0001", hashedPwd: "hashed-pw" });
    expect(state.student).toMatchObject({ id: "same-student-record", userId: state.user.id, currentGrade: 9 });
    expect(state.enrollments()).toEqual([{ studentId: "ordinary-student", classId: "ordinary-class" }, { studentId: state.student.id, classId: "cha-class-grade9a" }]);
    expect(state.placement).toMatchObject({ id: "same-placement", estimatedGrade: 9, band: "G7_9", teacherGrade: null });
    expect(state.ordinary).toEqual(ordinaryBefore);
    expect([...state.users.values()].filter((row) => row.email === chaDemoStudentEmail())).toHaveLength(1);
    expect(mockPrismaInstance.student.create).not.toHaveBeenCalled();
    expect(mockPrismaInstance.placementTest.create).not.toHaveBeenCalled();
    expect(await loadShowcaseStudentAuthority(state.user)).toMatchObject({ id: state.student.id });
    const labs = await loadAuthorizedShowcaseLabs(state.user);
    expect(labs.map((lab) => lab.labId)).toEqual(["g4-solid-figures", "fixture-lever", "fixture-simple-circuit", "mount-coffee-hydropower"]);
    expect(labs).toHaveLength(4);
    expect(labs.every((lab) => lab.runtime.kind === "INTERACTIVE_V2" && lab.release.status === "DRAFT_UNRELEASED")).toBe(true);
  });
  it("repairs only the configured email in identity-only mode, without reseeding curriculum or other accounts", async () => {
    vi.stubEnv("E2E_DEMO_STUDENT_EMAIL", "configured-demo@example.test");
    try {
      const state = staleDemo();
      await seedChaDemo({ studentIdentityOnly: true });
      expect(state.user).toMatchObject({ email: "configured-demo@example.test", loginId: "CHA-2026-0001" });
      expect(state.student.currentGrade).toBe(9);
      expect(mockPrismaInstance.user.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrismaInstance.curriculumContent.upsert).not.toHaveBeenCalled();
      expect(mockPrismaInstance.exam.upsert).not.toHaveBeenCalled();
      expect(mockPrismaInstance.school.upsert).not.toHaveBeenCalled();
      expect(mockPrismaInstance.placementTest.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: state.student.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
      expect(await loadAuthorizedShowcaseLabs(state.user)).toHaveLength(4);
    } finally { vi.unstubAllEnvs(); }
  });
  it("identity-only mode refuses a missing demo account instead of creating a replacement", async () => {
    await expect(seedChaDemo({ studentIdentityOnly: true })).rejects.toThrow("existing demo account");
    expect(mockPrismaInstance.user.upsert).not.toHaveBeenCalled();
  });
  it.each([
    { role: "TEACHER", loginId: null, schoolId: null },
    { role: "STUDENT", loginId: "wrong", schoolId: "old-school" },
  ])("restores missing/stale role, login and school fields on the exact demo account: %j", async (stale) => {
    const state = staleDemo();
    Object.assign(state.user, stale);
    await seedChaDemo({ studentIdentityOnly: true });
    expect(state.user).toMatchObject({ role: "STUDENT", loginId: "CHA-2026-0001", schoolId: "school-cha" });
    expect(await loadAuthorizedShowcaseLabs(state.user)).toHaveLength(4);
  });
  it("refuses an absent or foreign canonical class without writing identity", async () => {
    staleDemo();
    mockPrismaInstance.class.findUnique.mockResolvedValue({ id: "cha-class-grade9a", schoolId: "other-school" });
    await expect(seedChaDemo({ studentIdentityOnly: true })).rejects.toThrow("canonical CHA school and Grade 9A class");
    expect(mockPrismaInstance.user.upsert).not.toHaveBeenCalled();
  });
  it("rolls back the demo repair when the placement is linked to official authority", async () => {
    const state = staleDemo();
    state.placement.decision = { id: "official-decision", finalGrade: 7 };
    const before = structuredClone({ user: state.user, student: state.student, enrollments: state.enrollments(), placement: state.placement });
    await expect(seedChaDemo({ studentIdentityOnly: true })).rejects.toThrow("governed placement");
    expect({ user: state.user, student: state.student, enrollments: state.enrollments(), placement: state.placement }).toEqual(before);
  });
});

describe("hosted User-only repair", () => {
  function hostedState() {
    const state = staleDemo();
    Object.assign(state.user, { schoolId: "school-cha", loginId: null, isPlatformAdmin: true });
    state.enrollments()[0].classId = "cha-class-grade9a";
    Object.assign(state.placement, { estimatedGrade: 5, questions: [{ prompt: "Legacy question" }], answers: [{ response: "Historical response" }], decision: { finalGrade: 7 } });
    const history = {
      student: state.student, enrollments: state.enrollments(), placements: [state.placement],
      class: { id: "cha-class-grade9a", name: "Grade 7 - Capitol Hill Academy", subject: "MATH", schoolId: "school-cha" },
      quizAttempts: [{ id: "quiz", source: "student.lesson.quiz.submit", score: 0.7 }],
      quizDetails: [{ attemptId: "quiz", response: "Historical answer", isCorrect: true }],
      mastery: [{ studentId: state.student.id, currentScore: 0.6 }],
      adaptiveMastery: [{ studentId: state.student.id, skillKey: "MATH:G7:geometry", masteredAt: "2026-06-01" }],
      certificates: [{ studentId: state.student.id, referenceId: "historical-lesson" }],
      learningEvents: [{ source: "assessment_evaluation", studentId: state.student.id }],
      scheduledWork: [{ id: "historical-lesson", classId: "cha-class-grade9a", contentId: "grade7-lesson" }],
      assignments: [{ classId: "cha-class-grade9a", generationMethod: "ai_generated" }],
      homework: [{ studentId: state.student.id, answers: { q1: "Preserve" } }],
    };
    // The transaction receives only read ports and User.update. Any other write/read is a test failure.
    mockPrismaInstance.$transaction.mockImplementation(async (callback, options) => {
      expect(options).toEqual({ isolationLevel: "Serializable" });
      return callback({
        school: { findUnique: mockPrismaInstance.school.findUnique },
        user: { findUnique: mockPrismaInstance.user.findUnique, update: mockPrismaInstance.user.update },
        student: { findUnique: mockPrismaInstance.student.findUnique },
      });
    });
    return { ...state, history };
  }

  it("repairs the same User while preserving all Grade 7 learning history and authorizing exactly four labs", async () => {
    const state = hostedState();
    const historyBefore = JSON.stringify(state.history);
    const unrelatedBefore = JSON.stringify(state.ordinary);
    const labBefore = await loadAuthorizedShowcaseLabs(state.user);
    expect(labBefore).toEqual([]);
    await seedChaDemo({ studentUserIdentityOnly: true });
    await seedChaDemo({ studentUserIdentityOnly: true });
    expect(state.user).toMatchObject({ id: "same-student-user", email: chaDemoStudentEmail(), name: "Fatu Kollie", role: "STUDENT", schoolId: "school-cha", loginId: "CHA-2026-0001", hashedPwd: "hashed-pw", isPlatformAdmin: false });
    expect(JSON.stringify(state.history)).toBe(historyBefore);
    expect(JSON.stringify(state.ordinary)).toBe(unrelatedBefore);
    expect(state.student).toMatchObject({ id: "same-student-record", userId: state.user.id, currentGrade: 7 });
    expect(state.users.size).toBe(2);
    expect(bcrypt.hash).toHaveBeenCalledWith("approved-test-demo-password", 10);
    expect(mockPrismaInstance.user.update).toHaveBeenCalledTimes(2);
    for (const [model, ports] of Object.entries(mockPrismaInstance)) {
      if (typeof ports !== "object") continue;
      for (const [operation, mock] of Object.entries(ports)) {
        if (/^(create|update|upsert|delete)/.test(operation) && !(model === "user" && operation === "update")) {
          expect(mock, `${model}.${operation} must not mutate hosted learner history`).not.toHaveBeenCalled();
        }
      }
    }
    expect(mockPrismaInstance.placementTest.findFirst).not.toHaveBeenCalled();
    expect(await loadShowcaseStudentAuthority(state.user)).toMatchObject({ id: state.student.id });
    const labs = await loadAuthorizedShowcaseLabs(state.user);
    expect(labs.map((lab) => lab.labId)).toEqual([...SHOWCASE_LAB_IDS]);
    expect(labs.every((lab) => lab.runtime.kind === "INTERACTIVE_V2" && lab.release.status === "DRAFT_UNRELEASED")).toBe(true);
  });
  it("uses the exact configured email and restores a stale role without normalizing Student", async () => {
    vi.stubEnv("E2E_DEMO_STUDENT_EMAIL", "configured-demo@example.test");
    try {
      const state = hostedState();
      state.user.role = "ADMIN";
      const before = JSON.stringify(state.history);
      await seedChaDemo({ studentUserIdentityOnly: true });
      expect(state.user).toMatchObject({ email: "configured-demo@example.test", role: "STUDENT", schoolId: "school-cha" });
      expect(JSON.stringify(state.history)).toBe(before);
      expect(mockPrismaInstance.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "configured-demo@example.test" } }));
      expect(await loadAuthorizedShowcaseLabs(state.user)).toHaveLength(4);
    } finally { vi.unstubAllEnvs(); }
  });
  it("fails closed when the login ID belongs to another user", async () => {
    const state = hostedState();
    state.ordinary.loginId = "CHA-2026-0001";
    const before = JSON.stringify({ user: state.user, history: state.history, unrelated: state.ordinary });
    await expect(seedChaDemo({ studentUserIdentityOnly: true })).rejects.toThrow("login ID");
    expect(mockPrismaInstance.user.update).not.toHaveBeenCalled();
    expect(JSON.stringify({ user: state.user, history: state.history, unrelated: state.ordinary })).toBe(before);
  });
  it("lets the unique constraint abort a concurrent login-ID claim without writes to history", async () => {
    const state = hostedState();
    const before = JSON.stringify({ user: state.user, history: state.history });
    mockPrismaInstance.user.update.mockRejectedValue(Object.assign(new Error("Unique login ID"), { code: "P2002" }));
    await expect(seedChaDemo({ studentUserIdentityOnly: true })).rejects.toMatchObject({ code: "P2002" });
    expect(JSON.stringify({ user: state.user, history: state.history })).toBe(before);
  });
  it.each([null, { id: "school-cha", code: "WRONG" }, { id: "wrong-school", code: "CHA" }])("rejects a missing/wrong canonical school: %j", async (school) => {
    hostedState();
    mockPrismaInstance.school.findUnique.mockResolvedValue(school);
    await expect(seedChaDemo({ studentUserIdentityOnly: true })).rejects.toThrow("canonical CHA school");
    expect(mockPrismaInstance.user.update).not.toHaveBeenCalled();
  });
  it.each(["User", "Student", "linkage"])("requires the existing %s", async (missing) => {
    hostedState();
    if (missing === "User") mockPrismaInstance.user.findUnique.mockResolvedValue(null);
    if (missing === "Student") mockPrismaInstance.student.findUnique.mockResolvedValue(null);
    if (missing === "linkage") mockPrismaInstance.student.findUnique.mockResolvedValue({ id: "foreign", userId: "foreign" });
    await expect(seedChaDemo({ studentUserIdentityOnly: true })).rejects.toThrow(/existing demo User|linked Student/);
    expect(mockPrismaInstance.user.update).not.toHaveBeenCalled();
  });
  it("requires an explicitly approved password even in local mode", async () => {
    hostedState();
    vi.stubEnv("DEMO_SEED_PASSWORD", "");
    await expect(seedChaDemo({ studentUserIdentityOnly: true })).rejects.toThrow("DEMO_SEED_PASSWORD");
    expect(mockPrismaInstance.$transaction).not.toHaveBeenCalled();
  });
  it("rejects combined repair modes before any database access", async () => {
    await expect(seedChaDemo({ studentUserIdentityOnly: true, studentIdentityOnly: true })).rejects.toThrow("mutually exclusive");
    expect(mockPrismaInstance.$transaction).not.toHaveBeenCalled();
  });
  it("dispatches the precise CLI mode and rejects ambiguous or misspelled flags", () => {
    expect(parseChaDemoSeedOptions(["--student-user-identity-only"])).toEqual({ studentUserIdentityOnly: true });
    expect(parseChaDemoSeedOptions(["--student-identity-only"])).toEqual({ studentIdentityOnly: true });
    expect(parseChaDemoSeedOptions([])).toEqual({});
    expect(() => parseChaDemoSeedOptions(["--student-user-identity-ony"])).toThrow("Unknown CHA seed argument");
    expect(() => parseChaDemoSeedOptions(["--student-user-identity-only", "--student-identity-only"])).toThrow("mutually exclusive");
  });
});
