/**
 * GET /api/admin/dashboard/school/risk-summary
 *
 * Aggregate dropout risk by grade band (no student identifiers).
 * Feature flag: ENABLE_DROPOUT_RISK (default OFF -> 404)
 * Auth: ADMIN or DISTRICT_ADMIN + VIEW_SCHOOL_DASHBOARD
 * Tenant scope: schoolId
 *
 * Audit action: "risk.admin.school_summary.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { prisma } from "@/lib/db";
import { isDropoutRiskEnabled } from "@/lib/serverFlags";
import { computeDropoutRisk } from "@/lib/metrics/risk/dropoutRiskEngine";

export const dynamic = "force-dynamic";

const RECENT_DAYS = 14;
const PRIOR_DAYS = 14;

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function windowStart(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return startOfDayUtc(d);
}

function windowBucket(date: Date, recentStart: Date): "recent" | "prior" {
  return date >= recentStart ? "recent" : "prior";
}

function safeRate(numerator: number, denominator: number): number | undefined {
  if (!denominator || denominator <= 0) return undefined;
  return numerator / denominator;
}

function gradeBandFor(grade: number | null | undefined): string {
  if (!grade || !Number.isFinite(grade)) return "unknown";
  if (grade <= 3) return "G1_3";
  if (grade <= 6) return "G4_6";
  if (grade <= 9) return "G7_9";
  if (grade <= 12) return "G10_12";
  return "unknown";
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isDropoutRiskEnabled()) {
      return NextResponse.json({ error: "dropout_risk_disabled" }, { status: 404 });
    }

    const user = await requireRole("ADMIN", "DISTRICT_ADMIN");
    assertPermission(user, PERMISSIONS.VIEW_SCHOOL_DASHBOARD);

    const { searchParams } = new URL(req.url);
    const requestedSchoolId = searchParams.get("schoolId");

    if (!user.isPlatformAdmin && requestedSchoolId && requestedSchoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const effectiveSchoolId = user.isPlatformAdmin
      ? (requestedSchoolId ?? user.schoolId ?? null)
      : (user.schoolId ?? null);

    if (!effectiveSchoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const students = await prisma.student.findMany({
      where: { user: { schoolId: effectiveSchoolId } },
      select: { id: true, currentGrade: true },
    });

    if (students.length === 0) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        schoolId: effectiveSchoolId,
        byGradeBand: {},
      });
    }

    const studentIds = students.map((s) => s.id);

    const classes = await prisma.class.findMany({
      where: { schoolId: effectiveSchoolId },
      select: { id: true },
    });
    const classIds = classes.map((c) => c.id);

    const now = new Date();
    const recentStart = windowStart(RECENT_DAYS);
    const priorStart = windowStart(RECENT_DAYS + PRIOR_DAYS);

    const [
      attendanceRows,
      homeworkRows,
      assignmentSubmissionRows,
      recentAssignments,
      priorAssignments,
      masteryProfiles,
    ] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          studentId: { in: studentIds },
          Meeting: {
            classId: { in: classIds },
            startsAt: { gte: priorStart, lt: now },
          },
        },
        select: {
          studentId: true,
          status: true,
          Meeting: { select: { startsAt: true } },
        },
      }),
      prisma.homeworkSubmission.findMany({
        where: {
          studentId: { in: studentIds },
          submittedAt: { gte: priorStart, lt: now },
        },
        select: { studentId: true, submittedAt: true },
      }),
      prisma.assignmentSubmission.findMany({
        where: {
          studentId: { in: studentIds },
          turnedInAt: { gte: priorStart, lt: now },
        },
        select: { studentId: true, assignmentId: true, turnedInAt: true },
      }),
      prisma.assignment.findMany({
        where: {
          classId: { in: classIds },
          dueAt: { gte: recentStart, lt: now },
        },
        select: { id: true, classId: true },
      }),
      prisma.assignment.findMany({
        where: {
          classId: { in: classIds },
          dueAt: { gte: priorStart, lt: recentStart },
        },
        select: { id: true, classId: true },
      }),
      prisma.studentMasteryProfile.findMany({
        where: { studentId: { in: studentIds } },
        select: {
          studentId: true,
          currentScore: true,
          baselineScore: true,
          masteryState: true,
          aiRelianceRate: true,
        },
      }),
    ]);

    const attendanceByStudent = new Map<
      string,
      { recentPresent: number; recentTotal: number; priorPresent: number; priorTotal: number }
    >();

    for (const row of attendanceRows) {
      const bucket = windowBucket(row.Meeting.startsAt, recentStart);
      const entry = attendanceByStudent.get(row.studentId) ?? {
        recentPresent: 0,
        recentTotal: 0,
        priorPresent: 0,
        priorTotal: 0,
      };
      const isPresent = row.status === "PRESENT" || row.status === "LATE";
      if (bucket === "recent") {
        entry.recentTotal += 1;
        if (isPresent) entry.recentPresent += 1;
      } else {
        entry.priorTotal += 1;
        if (isPresent) entry.priorPresent += 1;
      }
      attendanceByStudent.set(row.studentId, entry);
    }

    const evidenceByStudent = new Map<string, { recent: number; prior: number }>();
    for (const row of homeworkRows) {
      const bucket = windowBucket(row.submittedAt, recentStart);
      const entry = evidenceByStudent.get(row.studentId) ?? { recent: 0, prior: 0 };
      entry[bucket] += 1;
      evidenceByStudent.set(row.studentId, entry);
    }
    for (const row of assignmentSubmissionRows) {
      if (!row.turnedInAt) continue;
      const bucket = windowBucket(row.turnedInAt, recentStart);
      const entry = evidenceByStudent.get(row.studentId) ?? { recent: 0, prior: 0 };
      entry[bucket] += 1;
      evidenceByStudent.set(row.studentId, entry);
    }

    const assignmentsRecentByClass = new Map<string, number>();
    const assignmentsPriorByClass = new Map<string, number>();
    const recentAssignmentIds = new Set<string>();
    const priorAssignmentIds = new Set<string>();

    for (const row of recentAssignments) {
      assignmentsRecentByClass.set(row.classId, (assignmentsRecentByClass.get(row.classId) ?? 0) + 1);
      recentAssignmentIds.add(row.id);
    }
    for (const row of priorAssignments) {
      assignmentsPriorByClass.set(row.classId, (assignmentsPriorByClass.get(row.classId) ?? 0) + 1);
      priorAssignmentIds.add(row.id);
    }

    const completionByStudent = new Map<
      string,
      { recentCompleted: number; recentTotal: number; priorCompleted: number; priorTotal: number }
    >();

    for (const student of students) {
      const recentTotal = classIds.reduce(
        (acc, cid) => acc + (assignmentsRecentByClass.get(cid) ?? 0),
        0
      );
      const priorTotal = classIds.reduce(
        (acc, cid) => acc + (assignmentsPriorByClass.get(cid) ?? 0),
        0
      );
      completionByStudent.set(student.id, {
        recentCompleted: 0,
        recentTotal,
        priorCompleted: 0,
        priorTotal,
      });
    }

    for (const row of assignmentSubmissionRows) {
      if (!row.assignmentId) continue;
      const entry = completionByStudent.get(row.studentId);
      if (!entry) continue;
      if (recentAssignmentIds.has(row.assignmentId)) entry.recentCompleted += 1;
      if (priorAssignmentIds.has(row.assignmentId)) entry.priorCompleted += 1;
    }

    const masteryByStudent = new Map<
      string,
      { currentAvg: number; baselineAvg: number; decayingFraction: number; aiRelianceAvg: number }
    >();

    const masteryBuckets = new Map<
      string,
      { count: number; currentSum: number; baselineSum: number; decayingCount: number; aiSum: number }
    >();

    for (const row of masteryProfiles) {
      const bucket = masteryBuckets.get(row.studentId) ?? {
        count: 0,
        currentSum: 0,
        baselineSum: 0,
        decayingCount: 0,
        aiSum: 0,
      };
      bucket.count += 1;
      bucket.currentSum += row.currentScore;
      bucket.baselineSum += row.baselineScore;
      bucket.aiSum += row.aiRelianceRate ?? 0;
      if (row.masteryState === "DECAYING") bucket.decayingCount += 1;
      masteryBuckets.set(row.studentId, bucket);
    }

    for (const [studentId, bucket] of masteryBuckets.entries()) {
      if (bucket.count === 0) continue;
      masteryByStudent.set(studentId, {
        currentAvg: bucket.currentSum / bucket.count,
        baselineAvg: bucket.baselineSum / bucket.count,
        decayingFraction: bucket.decayingCount / bucket.count,
        aiRelianceAvg: bucket.aiSum / bucket.count,
      });
    }

    const byGradeBand: Record<
      string,
      {
        total: number;
        low: number;
        medium: number;
        high: number;
        percentAtRisk: number;
      }
    > = {};

    let highRiskCount = 0;
    let mediumRiskCount = 0;

    for (const student of students) {
      const attendance = attendanceByStudent.get(student.id);
      const evidence = evidenceByStudent.get(student.id);
      const completion = completionByStudent.get(student.id);
      const mastery = masteryByStudent.get(student.id);

      const risk = computeDropoutRisk({
        attendance: {
          recentAttendanceRate: attendance
            ? safeRate(attendance.recentPresent, attendance.recentTotal)
            : undefined,
          priorAttendanceRate: attendance
            ? safeRate(attendance.priorPresent, attendance.priorTotal)
            : undefined,
          recentSessions: attendance?.recentTotal ?? 0,
        },
        evidenceVelocity: {
          recentEvidenceCount: evidence?.recent ?? 0,
          priorEvidenceCount: evidence?.prior ?? 0,
        },
        masteryDecline: {
          currentAvgMastery: mastery?.currentAvg,
          baselineAvgMastery: mastery?.baselineAvg,
          decayingFraction: mastery?.decayingFraction,
        },
        aiRelianceIncrease: {
          recentAiRelianceRate: mastery?.aiRelianceAvg,
          priorAiRelianceRate: undefined,
        },
        assignmentCompletion: {
          recentCompletionRate: completion
            ? safeRate(completion.recentCompleted, completion.recentTotal)
            : undefined,
          priorCompletionRate: completion
            ? safeRate(completion.priorCompleted, completion.priorTotal)
            : undefined,
        },
      });

      const band = gradeBandFor(student.currentGrade);
      const entry = byGradeBand[band] ?? {
        total: 0,
        low: 0,
        medium: 0,
        high: 0,
        percentAtRisk: 0,
      };
      entry.total += 1;

      if (risk.riskBand === "HIGH") {
        entry.high += 1;
        highRiskCount += 1;
      } else if (risk.riskBand === "MEDIUM") {
        entry.medium += 1;
        mediumRiskCount += 1;
      } else {
        entry.low += 1;
      }

      entry.percentAtRisk = entry.total
        ? Math.round(((entry.medium + entry.high) / entry.total) * 1000) / 10
        : 0;
      byGradeBand[band] = entry;
    }

    await logAudit({
      userId: user.id,
      action: "risk.admin.school_summary.viewed",
      resourceType: "dropout_risk",
      resourceId: effectiveSchoolId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        studentCount: students.length,
        bands: Object.keys(byGradeBand).length,
      },
    });

    recordMetricEvent(
      "risk_summary_admin_viewed",
      {
        studentCount: students.length,
        highRiskCount,
        mediumRiskCount,
      },
      { scope: "school", scopeId: effectiveSchoolId, schoolId: effectiveSchoolId }
    ).catch(() => {});

    if (Math.random() < 0.1) {
      const avgRisk = Math.round(
        (Object.values(byGradeBand).reduce((acc, b) => {
          const total = b.total || 0;
          if (!total) return acc;
          const weighted = b.low * 20 + b.medium * 50 + b.high * 80;
          return acc + weighted / total;
        }, 0) /
          Math.max(Object.values(byGradeBand).length, 1)) *
          10
      ) / 10;

      recordMetricEvent(
        "risk_engine_computed",
        { studentCount: students.length, avgRiskScore: avgRisk },
        { scope: "school", scopeId: effectiveSchoolId, schoolId: effectiveSchoolId, kind: "gauge" }
      ).catch(() => {});
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      schoolId: effectiveSchoolId,
      byGradeBand,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
