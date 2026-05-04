// __tests__/demo.seed.test.ts
// Verifies that seedChaDemo creates the five expected CHA demo accounts.
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mock instances so they persist across the module boundary
const mockPrismaInstance = vi.hoisted(() => ({
  school: { upsert: vi.fn() },
  user: { upsert: vi.fn() },
  student: { upsert: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  teacherProfile: { upsert: vi.fn() },
  studentGuardian: { upsert: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  class: { upsert: vi.fn() },
  curriculumContent: { upsert: vi.fn() },
  scheduledWork: { findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  exam: { upsert: vi.fn() },
  examQuestion: { deleteMany: vi.fn(), createMany: vi.fn() },
  certificate: { upsert: vi.fn() },
  learningEvent: { deleteMany: vi.fn(), createMany: vi.fn() },
  assessmentAttempt: { deleteMany: vi.fn(), createMany: vi.fn() },
  enrollment: { findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  placementTest: { findFirst: vi.fn(), create: vi.fn() },
  $disconnect: vi.fn(),
}));

// Use a real class so `new PrismaClient()` works (arrow fns can't be constructors)
vi.mock("@prisma/client", () => ({
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
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-pw") },
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    del = vi.fn().mockResolvedValue(1);
  },
}));

import { seedChaDemo } from "@/prisma/seeds/cha-demo";

const expectedAdminEmail = process.env.E2E_DEMO_ADMIN_EMAIL ?? ["admin", "cha.edu.lr"].join("@");
const expectedTeacherEmail = process.env.E2E_DEMO_TEACHER_EMAIL ?? ["teacher1", "cha.edu.lr"].join("@");
const expectedStudentEmail = process.env.E2E_DEMO_STUDENT_EMAIL ?? ["student1", "cha.edu.lr"].join("@");
const expectedGuardianEmail = process.env.E2E_DEMO_GUARDIAN_EMAIL ?? ["guardian1", "cha.family.lr"].join("@");
const expectedMoeEmail = process.env.E2E_DEMO_MOE_EMAIL ?? ["official1", "moe.gov.lr"].join("@");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DEMO_MOE_PASSWORD = "test-moe-password";
  mockPrismaInstance.school.upsert.mockResolvedValue({ id: "cha-high-academy" });
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
  mockPrismaInstance.placementTest.findFirst.mockResolvedValue(null);
  mockPrismaInstance.placementTest.create.mockResolvedValue({});
});

describe("seedChaDemo", () => {
  it("creates the CHA school record", async () => {
    await seedChaDemo();
    const schoolCall = mockPrismaInstance.school.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.code === "CHA"
    );
    expect(schoolCall).toBeDefined();
    expect(schoolCall![0].create).toMatchObject({
      id: "cha-high-academy",
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
