import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Prisma mock ─────────────────────────────────────────────────────────────
const mockFindMany = vi.fn();
const mockCreateMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    teacherAlert: {
      findMany: (...args: any[]) => mockFindMany(...args),
      createMany: (...args: any[]) => mockCreateMany(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: vi.fn().mockResolvedValue(undefined),
}));

import { getAllTeacherAlerts } from "@/lib/intelligence/teacherAlerts";

const TEACHER_ID = "teacher-1";
const SCHOOL_ID = "school-1";

function makeRow(overrides: object = {}) {
  return {
    id: "alert-1",
    alertType: "INACTIVE_STUDENT",
    severity: "medium",
    reason: "Student has been inactive for 9 days.",
    studentId: "stu-1",
    weakConcept: null,
    weakLesson: null,
    recommendedAction: "Check in with the student.",
    idempotencyKey: "key-1",
    status: "ACTIVE",
    createdAt: new Date("2026-04-20T10:00:00Z"),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockCreateMany.mockResolvedValue({ count: 0 });
  mockUpdate.mockResolvedValue({
    teacherUserId: TEACHER_ID,
    schoolId: SCHOOL_ID,
    alertType: "INACTIVE_STUDENT",
  });
});

// ── getAllTeacherAlerts ──────────────────────────────────────────────────────
describe("getAllTeacherAlerts", () => {
  it("filter=all queries all statuses", async () => {
    mockFindMany.mockResolvedValueOnce([makeRow({ status: "ACTIVE" }), makeRow({ id: "a2", status: "REVIEWED" })]);
    const result = await getAllTeacherAlerts(TEACHER_ID, SCHOOL_ID, "all");
    expect(result).toHaveLength(2);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["ACTIVE", "REVIEWED", "DISMISSED"] });
  });

  it("filter=active queries only ACTIVE", async () => {
    mockFindMany.mockResolvedValueOnce([makeRow({ status: "ACTIVE" })]);
    const result = await getAllTeacherAlerts(TEACHER_ID, SCHOOL_ID, "active");
    expect(result).toHaveLength(1);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.status).toBe("ACTIVE");
  });

  it("filter=reviewed queries only REVIEWED", async () => {
    mockFindMany.mockResolvedValueOnce([makeRow({ status: "REVIEWED" })]);
    const result = await getAllTeacherAlerts(TEACHER_ID, SCHOOL_ID, "reviewed");
    expect(result).toHaveLength(1);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.status).toBe("REVIEWED");
  });

  it("filter=dismissed queries only DISMISSED", async () => {
    mockFindMany.mockResolvedValueOnce([makeRow({ status: "DISMISSED" })]);
    const result = await getAllTeacherAlerts(TEACHER_ID, SCHOOL_ID, "dismissed");
    expect(result).toHaveLength(1);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.status).toBe("DISMISSED");
  });

  it("default filter (no arg) queries all statuses", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getAllTeacherAlerts(TEACHER_ID, SCHOOL_ID);
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["ACTIVE", "REVIEWED", "DISMISSED"] });
  });

  it("maps studentId to studentHref", async () => {
    mockFindMany.mockResolvedValueOnce([makeRow({ studentId: "stu-42" })]);
    const [item] = await getAllTeacherAlerts(TEACHER_ID, SCHOOL_ID, "all");
    expect(item.studentHref).toBe("/teacher/students/stu-42");
  });

  it("null studentId gives null studentHref", async () => {
    mockFindMany.mockResolvedValueOnce([makeRow({ studentId: null })]);
    const [item] = await getAllTeacherAlerts(TEACHER_ID, SCHOOL_ID, "all");
    expect(item.studentHref).toBeNull();
  });

  it("enforces take limit of 50", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getAllTeacherAlerts(TEACHER_ID, SCHOOL_ID, "all");
    expect(mockFindMany.mock.calls[0][0].take).toBe(50);
  });
});

// ── Teacher review link ──────────────────────────────────────────────────────
describe("teacher student review link", () => {
  it("teacher student page uses /teacher/lesson/ not /student/lesson/", () => {
    const filePath = path.resolve(
      "app/teacher/students/[studentId]/page.tsx"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toContain("/student/lesson/");
    expect(source).toContain("/teacher/lesson/");
  });
});

// ── Alert API route filter param ─────────────────────────────────────────────
describe("alerts API route filter logic", () => {
  it("alerts route file imports getAllTeacherAlerts", () => {
    const filePath = path.resolve("app/api/teacher/alerts/route.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("getAllTeacherAlerts");
  });

  it("alerts route file uses ?filter query param", () => {
    const filePath = path.resolve("app/api/teacher/alerts/route.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain('searchParams.get("filter")');
  });
});

// ── Dashboard alert panel ────────────────────────────────────────────────────
describe("teacher dashboard alert refactor", () => {
  it("dashboard does not render large card list of alerts inline", () => {
    const filePath = path.resolve("app/teacher/dashboard/page.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    // The old pattern rendered 8 full alert cards inline — now it's a compact summary
    expect(source).not.toContain("visibleAlerts.slice(0, 8)");
  });

  it("dashboard links to /teacher/alerts for full alert view", () => {
    const filePath = path.resolve("app/teacher/dashboard/page.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("/teacher/alerts");
  });

  it("dashboard imports AlertBell component", () => {
    const filePath = path.resolve("app/teacher/dashboard/page.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("AlertBell");
  });

  it("AlertBell renders bell icon with badge when alerts > 0", () => {
    const filePath = path.resolve("components/teacher/AlertBell.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("alert-bell-badge");
    expect(source).toContain("alert-bell-button");
    expect(source).toContain("alert-bell-dropdown");
  });

  it("AlertBell links to /teacher/alerts for full view", () => {
    const filePath = path.resolve("components/teacher/AlertBell.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("/teacher/alerts");
  });
});

// ── Full alerts page ─────────────────────────────────────────────────────────
describe("teacher alerts page", () => {
  it("alerts page exists", () => {
    const filePath = path.resolve("app/teacher/alerts/page.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("alerts page links back to dashboard", () => {
    const filePath = path.resolve("app/teacher/alerts/page.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("/teacher/dashboard");
  });

  it("alerts page supports filter tabs for all/active/reviewed/dismissed", () => {
    const filePath = path.resolve("app/teacher/alerts/page.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain('"all"');
    expect(source).toContain('"active"');
    expect(source).toContain('"reviewed"');
    expect(source).toContain('"dismissed"');
  });
});
