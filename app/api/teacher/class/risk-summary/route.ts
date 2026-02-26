/**
 * GET /api/teacher/class/risk-summary
 *
 * Per-student dropout risk for a teacher's own classes.
 * Feature flag: ENABLE_DROPOUT_RISK (default OFF -> 404)
 * Auth: TEACHER
 * Tenant scope: class -> schoolId + teacherId
 *
 * Audit action: "risk.teacher.class_summary.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
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

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isDropoutRiskEnabled()) {
      return NextResponse.json({ error: "dropout_risk_disabled" }, { status: 404 });
    }

    const user = await requireRole("TEACHER");
    const schoolId = user.schoolId ?? null;
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const classIdFilter = searchParams.get("classId");
    const includeBreakdown = searchParams.get("includeBreakdown") === "true";

    const classWhere: any = {
      schoolId,
      teacherId: user.id,
    };
    if (classIdFilter) classWhere.id = classIdFilter;

    const teacherClasses = await prisma.class.findMany({
      where: classWhere,
      select: { id: true, name: true },
    });

    if (classIdFilter && teacherClasses.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (teacherClasses.length === 0) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        classes: [],
      });
    }

    const classIds = teacherClasses.map((c) => c.id);

    const enrollments = await prisma.enrollment.findMany({
      where: { classId: { in: classIds } },
      include: {
        Student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const studentInfoById = new Map<
      string,
      { studentId: string; name: string; classIds: string[] }
    >();

    for (const row of enrollments) {
      const studentId = row.Student.id;
      const name = row.Student.user.name ?? row.Student.user.email ?? "Unknown";
      const existing = studentInfoById.get(studentId);
      if (existing) {
        if (!existing.classIds.includes(row.classId)) existing.classIds.push(row.classId);
      } else {
        studentInfoById.set(studentId, {
          studentId,
          name,
          classIds: [row.classId],
        });
      }
    }

    const studentIds = Array.from(studentInfoById.keys());
    if (studentIds.length === 0) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        classes: teacherClasses.map((c) => ({ classId: c.id, className: c.name, students: [] })),
      });
    }

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

    for (const [studentId, info] of studentInfoById.entries()) {
      const recentTotal = info.classIds.reduce(
        (acc, cid) => acc + (assignmentsRecentByClass.get(cid) ?? 0),
        0
      );
      const priorTotal = info.classIds.reduce(
        (acc, cid) => acc + (assignmentsPriorByClass.get(cid) ?? 0),
        0
      );
      completionByStudent.set(studentId, {
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

    const studentRisks = new Map<string, any>();
    const riskBandCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 } as Record<string, number>;

    for (const studentId of studentIds) {
      const attendance = attendanceByStudent.get(studentId);
      const evidence = evidenceByStudent.get(studentId);
      const completion = completionByStudent.get(studentId);
      const mastery = masteryByStudent.get(studentId);

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
        includeBreakdown,
      });

      studentRisks.set(studentId, risk);
      riskBandCounts[risk.riskBand] += 1;
    }

    const classes = teacherClasses.map((c) => {
      const students = Array.from(studentInfoById.values())
        .filter((s) => s.classIds.includes(c.id))
        .map((s) => ({
          studentId: s.studentId,
          name: s.name,
          risk: studentRisks.get(s.studentId),
        }));

      return {
        classId: c.id,
        className: c.name,
        students,
      };
    });

    await logAudit({
      userId: user.id,
      action: "risk.teacher.class_summary.viewed",
      resourceType: "dropout_risk",
      schoolId,
      traceId,
      details: {
        classCount: teacherClasses.length,
        studentCount: studentIds.length,
      },
    });

    recordMetricEvent(
      "risk_summary_teacher_viewed",
      {
        classCount: teacherClasses.length,
        studentCount: studentIds.length,
        highRiskCount: riskBandCounts.HIGH,
        mediumRiskCount: riskBandCounts.MEDIUM,
      },
      { scope: "school", scopeId: schoolId, schoolId }
    ).catch(() => {});

    if (Math.random() < 0.1) {
      const avgRisk =
        studentIds.length === 0
          ? 0
          : Math.round(
              (Array.from(studentRisks.values()).reduce(
                (acc: number, r: any) => acc + r.totalRiskScore,
                0
              ) /
                studentIds.length) *
                10
            ) / 10;
      recordMetricEvent(
        "risk_engine_computed",
        { studentCount: studentIds.length, avgRiskScore: avgRisk },
        { scope: "school", scopeId: schoolId, schoolId, kind: "gauge" }
      ).catch(() => {});
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      classes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
