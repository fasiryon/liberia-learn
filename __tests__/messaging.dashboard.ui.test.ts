import { describe, expect, it } from "vitest";
import { buildThreads } from "@/components/messaging/MessagingCenter";
import { buildDeliveryReportCsv, toDateRange } from "@/components/teacher/TeacherDeliveryReport";

describe("messaging thread helpers", () => {
  it("groups messages into threads and sorts latest thread first", () => {
    const threads = buildThreads([
      {
        messageId: "1",
        guardianId: "g-1",
        teacherId: "t-1",
        studentId: "s-1",
        guardianName: "Parent One",
        teacherName: "Teacher One",
        studentName: "Alice",
        subject: "MATH",
        fromRole: "guardian",
        fromName: "Parent One",
        body: "First",
        sentAt: "2026-03-01T09:00:00.000Z",
        read: false,
      },
      {
        messageId: "2",
        guardianId: "g-2",
        teacherId: "t-1",
        studentId: "s-2",
        guardianName: "Parent Two",
        teacherName: "Teacher One",
        studentName: "Bob",
        subject: "SCIENCE",
        fromRole: "teacher",
        fromName: "Teacher One",
        body: "Latest",
        sentAt: "2026-03-02T09:00:00.000Z",
        read: true,
      },
    ]);

    expect(threads).toHaveLength(2);
    expect(threads[0].studentName).toBe("Bob");
    expect(threads[1].messages[0].body).toBe("First");
  });
});

describe("delivery report helpers", () => {
  it("builds a date range ending today", () => {
    const range = toDateRange(30);
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("builds downloadable csv rows from delivered lessons", () => {
    const csv = buildDeliveryReportCsv([
      {
        id: "sched-1",
        className: "Grade 6 Math",
        title: "Fractions",
        scheduledDate: "2026-03-01T00:00:00.000Z",
        totalStudents: 20,
        completedCount: 15,
        isDelivered: true,
      },
    ]);

    expect(csv).toContain("Lesson Title,Class,Date,Status,Students Assigned,Completed,Rate");
    expect(csv).toContain("Fractions");
    expect(csv).toContain("Delivered");
    expect(csv).toContain("75%");
  });
});
