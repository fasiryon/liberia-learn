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
  scheduledWork: { upsert: vi.fn() },
  studentProgress: { upsert: vi.fn() },
  meeting: { upsert: vi.fn() },
  attendanceRecord: { upsert: vi.fn() },
  studentMasteryProfile: { upsert: vi.fn() },
  assignment: { upsert: vi.fn() },
  assignmentSubmission: { upsert: vi.fn() },
  homework: { upsert: vi.fn() },
  homeworkSubmission: { upsert: vi.fn() },
  grade: { upsert: vi.fn() },
  chatMessage: { upsert: vi.fn() },
  auditLog: { upsert: vi.fn() },
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
    studentProgress = mockPrismaInstance.studentProgress;
    meeting = mockPrismaInstance.meeting;
    attendanceRecord = mockPrismaInstance.attendanceRecord;
    studentMasteryProfile = mockPrismaInstance.studentMasteryProfile;
    assignment = mockPrismaInstance.assignment;
    assignmentSubmission = mockPrismaInstance.assignmentSubmission;
    homework = mockPrismaInstance.homework;
    homeworkSubmission = mockPrismaInstance.homeworkSubmission;
    grade = mockPrismaInstance.grade;
    chatMessage = mockPrismaInstance.chatMessage;
    auditLog = mockPrismaInstance.auditLog;
    enrollment = mockPrismaInstance.enrollment;
    placementTest = mockPrismaInstance.placementTest;
    $disconnect = mockPrismaInstance.$disconnect;
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-pw") },
}));

import { seedChaDemo } from "@/prisma/seeds/cha-demo";

beforeEach(() => {
  vi.clearAllMocks();
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
  mockPrismaInstance.curriculumContent.upsert.mockResolvedValue({});
  mockPrismaInstance.scheduledWork.upsert.mockResolvedValue({});
  mockPrismaInstance.studentProgress.upsert.mockResolvedValue({});
  mockPrismaInstance.meeting.upsert.mockResolvedValue({});
  mockPrismaInstance.attendanceRecord.upsert.mockResolvedValue({});
  mockPrismaInstance.studentMasteryProfile.upsert.mockResolvedValue({});
  mockPrismaInstance.assignment.upsert.mockResolvedValue({});
  mockPrismaInstance.assignmentSubmission.upsert.mockResolvedValue({});
  mockPrismaInstance.homework.upsert.mockResolvedValue({});
  mockPrismaInstance.homeworkSubmission.upsert.mockResolvedValue({});
  mockPrismaInstance.grade.upsert.mockResolvedValue({});
  mockPrismaInstance.chatMessage.upsert.mockResolvedValue({});
  mockPrismaInstance.auditLog.upsert.mockResolvedValue({});
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

  it("creates admin@cha.edu.lr with ADMIN role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === "admin@cha.edu.lr"
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("ADMIN");
  });

  it("creates teacher1@cha.edu.lr with TEACHER role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === "teacher1@cha.edu.lr"
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("TEACHER");
  });

  it("creates student1@cha.edu.lr with STUDENT role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === "student1@cha.edu.lr"
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("STUDENT");
  });

  it("creates guardian1@cha.family.lr with GUARDIAN role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === "guardian1@cha.family.lr"
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("GUARDIAN");
  });

  it("creates official1@moe.gov.lr with MOE_OFFICIAL role", async () => {
    await seedChaDemo();
    const call = mockPrismaInstance.user.upsert.mock.calls.find(
      (c: any[]) => c[0]?.where?.email === "official1@moe.gov.lr"
    );
    expect(call).toBeDefined();
    expect(call![0].create.role).toBe("MOE_OFFICIAL");
  });

  it("seeds dashboard-ready activity records for the demo accounts", async () => {
    await seedChaDemo();

    expect(mockPrismaInstance.curriculumContent.upsert).toHaveBeenCalled();
    expect(mockPrismaInstance.scheduledWork.upsert).toHaveBeenCalled();
    expect(mockPrismaInstance.studentProgress.upsert).toHaveBeenCalled();
    expect(mockPrismaInstance.attendanceRecord.upsert).toHaveBeenCalled();
    expect(mockPrismaInstance.studentMasteryProfile.upsert).toHaveBeenCalled();
    expect(mockPrismaInstance.assignmentSubmission.upsert).toHaveBeenCalled();
    expect(mockPrismaInstance.homeworkSubmission.upsert).toHaveBeenCalled();
    expect(mockPrismaInstance.grade.upsert).toHaveBeenCalled();
    expect(mockPrismaInstance.chatMessage.upsert).toHaveBeenCalled();
    expect(mockPrismaInstance.auditLog.upsert).toHaveBeenCalled();
  });
});
