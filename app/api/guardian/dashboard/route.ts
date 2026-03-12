// app/api/guardian/dashboard/route.ts
//
// GET /api/guardian/dashboard
//
// Returns a full summary of the logged-in guardian's linked children.
// Each child entry includes: recent grades, upcoming assignments,
// attendance summary, mastery profile, and active intervention alerts.
//
// Feature flag : ENABLE_GUARDIAN_DASHBOARD (default OFF → 404)
// Auth         : GUARDIAN role
// Scope        : guardian sees ONLY their linked children — hard enforced
// PII          : no data from non-linked students can appear

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGuardianDashboardEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function deriveTrend(current: number, baseline: number): "up" | "down" | "stable" {
  if (current > baseline + 0.05) return "up";
  if (current < baseline - 0.05) return "down";
  return "stable";
}

export async function GET() {
  try {
    if (!isGuardianDashboardEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("GUARDIAN");

    // Load all guardian → student links
    const links = await prisma.studentGuardian.findMany({
      where: { guardianId: user.id },
      select: { studentId: true },
    });

    if (links.length === 0) {
      return NextResponse.json(
        { error: "No linked students found for this guardian" },
        { status: 403 }
      );
    }

    const studentIds = links.map((l) => l.studentId);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const children = await Promise.all(
      studentIds.map(async (studentId) => {
        // ── Core student info ──────────────────────────────────────────────
        const student = await prisma.student.findUnique({
          where: { id: studentId },
          include: {
            user: { select: { name: true } },
            enrollments: {
              include: {
                Class: {
                  select: {
                    id: true,
                    name: true,
                    subject: true,
                    School: { select: { name: true } },
                  },
                },
              },
              take: 1, // primary class for school/className
            },
          },
        });

        if (!student) return null;

        const primaryEnrollment = student.enrollments[0] ?? null;
        const schoolName = primaryEnrollment?.Class?.School?.name ?? null;
        const className = primaryEnrollment?.Class?.name ?? null;
        const classIds = student.enrollments.map((e) => e.classId);

        // ── Recent grades ──────────────────────────────────────────────────
        const [hwSubmissions, assignmentSubmissions] = await Promise.all([
          prisma.homeworkSubmission.findMany({
            where: { studentId },
            orderBy: { submittedAt: "desc" },
            take: 5,
            include: {
              Homework: {
                select: { title: true, Class: { select: { subject: true } } },
              },
            },
          }),
          prisma.assignmentSubmission.findMany({
            where: { studentId, score: { not: null } },
            orderBy: { turnedInAt: "desc" },
            take: 5,
            include: {
              Assignment: {
                select: {
                  title: true,
                  points: true,
                  Class: { select: { subject: true } },
                },
              },
            },
          }),
        ]);

        const recentGrades = [
          ...hwSubmissions
            .filter((s) => s.teacherScore !== null || s.aiScore !== null)
            .map((s) => ({
              subject: String(s.Homework.Class.subject),
              assignmentTitle: s.Homework.title,
              score: s.teacherScore ?? s.aiScore ?? 0,
              maxScore: 100,
              date: s.submittedAt.toISOString(),
            })),
          ...assignmentSubmissions.map((s) => ({
            subject: String(s.Assignment.Class.subject),
            assignmentTitle: s.Assignment.title,
            score: s.score ?? 0,
            maxScore: s.Assignment.points,
            date: (s.turnedInAt ?? now).toISOString(),
          })),
        ]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5);

        // ── Upcoming assignments ───────────────────────────────────────────
        const [upcomingHw, upcomingAssignments] = await Promise.all([
          classIds.length > 0
            ? prisma.homework.findMany({
                where: {
                  classId: { in: classIds },
                  dueAt: { gte: now, lte: thirtyDaysAhead },
                },
                select: {
                  title: true,
                  dueAt: true,
                  Class: { select: { subject: true } },
                },
                orderBy: { dueAt: "asc" },
                take: 10,
              })
            : Promise.resolve([]),
          classIds.length > 0
            ? prisma.assignment.findMany({
                where: {
                  classId: { in: classIds },
                  dueAt: { gte: now, lte: thirtyDaysAhead },
                },
                select: {
                  title: true,
                  dueAt: true,
                  Class: { select: { subject: true } },
                },
                orderBy: { dueAt: "asc" },
                take: 10,
              })
            : Promise.resolve([]),
        ]);

        const upcomingList = [
          ...upcomingHw.map((h) => ({
            subject: String(h.Class.subject),
            title: h.title,
            dueAt: h.dueAt!.toISOString(),
            type: "homework" as const,
          })),
          ...upcomingAssignments.map((a) => ({
            subject: String(a.Class.subject),
            title: a.title,
            dueAt: a.dueAt!.toISOString(),
            type: "assignment" as const,
          })),
        ].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

        // ── Attendance ─────────────────────────────────────────────────────
        const attendanceRecords = await prisma.attendanceRecord.findMany({
          where: { studentId, markedAt: { gte: thirtyDaysAgo } },
          select: { status: true },
        });

        const presentDays = attendanceRecords.filter(
          (r) => r.status === "PRESENT"
        ).length;
        const absentDays = attendanceRecords.filter(
          (r) => r.status === "ABSENT"
        ).length;
        const totalDays = attendanceRecords.length;
        const attendanceRate =
          totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 1000 : 0;

        // ── Mastery profile ────────────────────────────────────────────────
        const masteryRows = await prisma.studentMasteryProfile.findMany({
          where: { studentId },
          select: {
            subject: true,
            strandKey: true,
            currentScore: true,
            baselineScore: true,
          },
          orderBy: [{ subject: "asc" }, { strandKey: "asc" }],
        });

        const masteryProfile = masteryRows.map((m) => ({
          subject: String(m.subject),
          strandKey: m.strandKey,
          masteryLevel: m.currentScore,
          trend: deriveTrend(m.currentScore, m.baselineScore),
        }));

        // ── Intervention alerts (derived from mastery state) ───────────────
        const alertRows = await prisma.studentMasteryProfile.findMany({
          where: {
            studentId,
            OR: [
              { masteryState: "DECAYING" },
              { proficiencyState: "BELOW_PROFICIENT" },
            ],
          },
          select: {
            subject: true,
            strandKey: true,
            masteryState: true,
            proficiencyState: true,
            updatedAt: true,
          },
        });

        const interventionAlerts = alertRows.map((a) => ({
          subject: String(a.subject),
          strandKey: a.strandKey,
          alertType:
            a.masteryState === "DECAYING"
              ? "declining_mastery"
              : "below_proficient",
          createdAt: a.updatedAt.toISOString(),
        }));

        return {
          studentId: student.id,
          studentName: student.user.name ?? "Unknown",
          grade: student.currentGrade ?? null,
          school: schoolName,
          className,
          recentGrades,
          upcomingAssignments: upcomingList,
          attendance: { presentDays, absentDays, attendanceRate },
          masteryProfile,
          interventionAlerts,
        };
      })
    );

    // Filter out nulls (students not found)
    const validChildren = children.filter(Boolean);

    // Count unread messages for this guardian
    const unreadMessages = await prisma.guardianMessage.count({
      where: { guardianId: user.id, read: false },
    });

    void logAudit({
      userId: user.id,
      action: "guardian.dashboard.viewed",
      resourceType: "guardian_dashboard",
      resourceId: user.id,
      schoolId: user.schoolId,
    });

    return NextResponse.json({
      children: validChildren,
      unreadMessages,
      lastUpdated: now.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
