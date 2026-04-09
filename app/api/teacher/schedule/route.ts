import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  isAbBlockSchedulingEnabled,
  isAssignmentLessonLinkageEnabled,
  isVirtualLabsEnabled,
  isDeliveryComplianceReportingEnabled,
} from "@/lib/serverFlags";
import { randomUUID } from "crypto";
import { withRequestLogging } from "@/lib/logging/requestLogger";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { listTeacherScheduleForUser } from "@/lib/records/schoolOperations";

export const dynamic = "force-dynamic";

async function _scheduleGET(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const weekOf = searchParams.get("weekOf");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const deliveredOnly = searchParams.get("deliveredOnly") === "true";

    const teacherScope = await listTeacherScheduleForUser(user);
    const classes = teacherScope.classes;
    const classIds = classes.map((c) => c.id);

    const baseDate = weekOf ? new Date(weekOf) : new Date();
    const day = baseDate.getUTCDay();
    const monday = new Date(baseDate);
    monday.setUTCDate(baseDate.getUTCDate() - ((day + 6) % 7));
    monday.setUTCHours(0, 0, 0, 0);
    const friday = new Date(monday);
    friday.setUTCDate(monday.getUTCDate() + 5);

    const rangeStart = from ? new Date(from) : monday;
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = to ? new Date(to) : friday;
    rangeEnd.setUTCHours(23, 59, 59, 999);

    const schedule = await prisma.scheduledWork.findMany({
      where: {
        classId: { in: classIds },
        scheduledDate: { gte: rangeStart, lte: rangeEnd },
        ...(deliveredOnly ? { isDelivered: true } : {}),
      },
      include: {
        content: {
          select: {
            contentId: true,
            subject: true,
            payload: true,
            moeAlignments: true,
            grade: true,
            deliveryProfile: true,
          },
        },
        progress: { where: { completedAt: { not: null } }, select: { id: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Get total enrollments per class for completion %
    const enrollmentCounts = await prisma.enrollment.groupBy({
      by: ["classId"],
      where: { classId: { in: classIds } },
      _count: true,
    });
    const enrollMap = Object.fromEntries(enrollmentCounts.map((e) => [e.classId, e._count]));

    const items = schedule.map((sw) => ({
      id: sw.id,
      classId: sw.classId,
      className: classes.find((c) => c.id === sw.classId)?.name || "",
      contentId: sw.content.contentId,
      title: (sw.content.payload as any)?.title || sw.content.subject,
      subject: sw.content.subject,
      scheduledDate: sw.scheduledDate,
      completedCount: sw.progress.length,
      totalStudents: enrollMap[sw.classId] || 0,
      // Part 2 fields
      classFormat: sw.classFormat,
      isDelivered: sw.isDelivered,
      deliveredAt: sw.deliveredAt,
      completionRate: sw.completionRate,
      sessionPairId: sw.sessionPairId,
      status: sw.status,
    }));

    const response: Record<string, unknown> = {
      items,
      classes,
      timetable: teacherScope.timetable,
      weekStart: monday.toISOString(),
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
    };

    // Part 8: enhanced compliance fields
    if (isDeliveryComplianceReportingEnabled()) {
      const scheduleIds = schedule.map((sw) => sw.id);

      // MOE standards coverage — unique codes from all items' moeAlignments
      const allCodes = new Set<string>();
      for (const sw of schedule) {
        const alignments = sw.content.moeAlignments as Array<{ code: string }> | null;
        if (alignments) alignments.forEach((a) => a.code && allCodes.add(a.code));
      }

      // Planned vs delivered
      const deliveredCount = schedule.filter((sw) => sw.isDelivered).length;

      // PERF FIX (Block 26): Parallelize the 3 compliance count queries.
      // Before: 3 sequential awaits. After: 1 parallel round-trip.
      const [pendingAssignmentSuggestions, labSessionsThisWeek, pendingLabSessions] =
        await Promise.all([
          prisma.assignmentSuggestion.count({
            where: { schoolId: user.schoolId!, status: "pending" },
          }),
          scheduleIds.length > 0
            ? prisma.labSession.count({
                where: { scheduledWorkId: { in: scheduleIds }, completedAt: { not: null } },
              })
            : Promise.resolve(0),
          scheduleIds.length > 0
            ? prisma.labSession.count({
                where: { scheduledWorkId: { in: scheduleIds }, completedAt: null },
              })
            : Promise.resolve(0),
        ]);

      // Unit progress — group by unitId
      const unitProgressMap = new Map<
        string,
        { unitId: string; unitName: string; lessonsScheduled: number; lessonsDelivered: number }
      >();
      for (const sw of schedule) {
        const unitId = (sw.content as any).unitId;
        if (unitId) {
          const existing = unitProgressMap.get(unitId);
          if (existing) {
            existing.lessonsScheduled += 1;
            if (sw.isDelivered) existing.lessonsDelivered += 1;
          } else {
            unitProgressMap.set(unitId, {
              unitId,
              unitName: unitId,
              lessonsScheduled: 1,
              lessonsDelivered: sw.isDelivered ? 1 : 0,
            });
          }
        }
      }

      // Pacing status: simple heuristic based on delivery rate
      const totalPlanned = schedule.length;
      const deliveryRate = totalPlanned > 0 ? deliveredCount / totalPlanned : 0;
      const pacingStatus =
        deliveryRate >= 0.9 ? "on_track" : deliveryRate >= 0.6 ? "behind" : "behind";

      response.moeStandardsCoverage = Array.from(allCodes);
      response.pacingStatus = pacingStatus;
      response.plannedVsDelivered = { planned: totalPlanned, delivered: deliveredCount };
      response.pendingAssignmentSuggestions = pendingAssignmentSuggestions;
      response.labSessionsThisWeek = labSessionsThisWeek;
      response.pendingLabSessions = pendingLabSessions;
      response.unitProgress = Array.from(unitProgressMap.values());
      response.unscheduledStandards = [];
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export const GET = withRequestLogging("/api/teacher/schedule", _scheduleGET);

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const {
      contentId,
      classId,
      scheduledDate,
      startTime,
      endTime,
      periodNumber,
      classFormat,
      deliveryNotes,
    } = await req.json();

    if (!contentId || !classId || !scheduledDate) {
      return NextResponse.json({ error: "contentId, classId, scheduledDate required" }, { status: 400 });
    }

    // Verify class belongs to teacher's school
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!cls || cls.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load content for delivery profile and moe alignments
    const content = await prisma.curriculumContent.findUnique({
      where: { contentId },
      select: { id: true, grade: true, subject: true, moeAlignments: true, payload: true, deliveryProfile: true },
    });

    // Part 3: A/B block pairing
    const deliveryProfile = content?.deliveryProfile as any;
    const hasSplitPoint = deliveryProfile?.splitPoint != null;
    const isBlockFormat = classFormat === "block_a" || classFormat === "block_b";
    const shouldPair = isAbBlockSchedulingEnabled() && isBlockFormat && hasSplitPoint;
    const sessionPairId = shouldPair ? randomUUID() : undefined;

    // Part 7: virtual lab auto-binding
    let suggestedLabs: any = undefined;
    if (isVirtualLabsEnabled() && content?.moeAlignments) {
      const alignments = content.moeAlignments as Array<{ code: string }>;
      const codes = alignments.map((a) => a.code).filter(Boolean);
      if (codes.length > 0) {
        const labs = await prisma.virtualLab.findMany({
          where: {
            status: "published",
            grade: content.grade,
            triggerStandardCodes: { hasSome: codes },
            OR: [{ schoolId: null }, { schoolId: user.schoolId! }],
          },
          select: { id: true, labId: true, title: true, labType: true, estimatedMinutes: true },
          take: 3,
        });
        if (labs.length > 0) suggestedLabs = labs;
      }
    }

    const sw = await prisma.scheduledWork.create({
      data: {
        contentId,
        classId,
        scheduledDate: new Date(scheduledDate),
        createdById: user.id,
        startTime: startTime ?? undefined,
        endTime: endTime ?? undefined,
        periodNumber: periodNumber ?? undefined,
        classFormat: classFormat ?? undefined,
        status: shouldPair ? "confirmed" : undefined,
        sessionPairId: sessionPairId ?? undefined,
        suggestedLabs: suggestedLabs ?? undefined,
        deliveryNotes: deliveryNotes ?? undefined,
      },
    });

    // PERF FIX (Block 26): Parallelize A/B sibling create and AssignmentSuggestion create.
    // Before: 2 sequential conditional writes after main sw.create.
    // After:  Both fire in parallel — neither depends on the other's result.
    const shouldCreateSuggestion =
      isAssignmentLessonLinkageEnabled() && !!deliveryProfile?.exitTicket?.questions?.length;

    let siblingData: { date: Date; format: string } | null = null;
    if (shouldPair) {
      const siblingDate = new Date(scheduledDate);
      siblingDate.setDate(siblingDate.getDate() + 2);
      siblingData = { date: siblingDate, format: classFormat === "block_a" ? "block_b" : "block_a" };
    }

    const alignmentsForSuggestion = content?.moeAlignments as Array<{ code: string }> | null;
    const moeCodes = alignmentsForSuggestion
      ? alignmentsForSuggestion.map((a) => a.code).filter(Boolean)
      : [];
    const lessonTitle = (content?.payload as any)?.title ?? "Lesson";
    const suggestedDue = new Date(scheduledDate);
    suggestedDue.setDate(suggestedDue.getDate() + 1);

    const [sibling] = await Promise.all([
      siblingData
        ? prisma.scheduledWork.create({
            data: {
              contentId,
              classId,
              scheduledDate: siblingData.date,
              createdById: user.id,
              startTime: startTime ?? undefined,
              endTime: endTime ?? undefined,
              periodNumber: periodNumber ?? undefined,
              classFormat: siblingData.format,
              status: "suggested",
              sessionPairId,
              suggestedLabs: suggestedLabs ?? undefined,
            },
          })
        : Promise.resolve(null),
      shouldCreateSuggestion
        ? prisma.assignmentSuggestion.create({
            data: {
              schoolId: user.schoolId!,
              contentId,
              scheduledWorkId: sw.id,
              classId,
              suggestedTitle: `Check for Understanding: ${lessonTitle}`,
              suggestedDueDate: suggestedDue,
              moeStandardCodes: moeCodes,
              status: "pending",
            },
          })
        : Promise.resolve(null),
    ]);

    const suggestedPair = sibling
      ? {
          id: sibling.id,
          scheduledDate: sibling.scheduledDate,
          classFormat: sibling.classFormat,
          status: sibling.status,
        }
      : undefined;

    await logAudit({
      userId: user.id,
      action: "schedule.created",
      resourceType: "scheduledWork",
      resourceId: sw.id,
      details: { classFormat, sessionPairId },
      schoolId: user.schoolId ?? undefined,
    });

    return NextResponse.json({
      id: sw.id,
      ...(suggestedPair ? { suggestedPair } : {}),
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const sw = await prisma.scheduledWork.findUnique({
      where: { id },
      include: { class: { select: { schoolId: true } } },
    });

    if (!sw || sw.class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.scheduledWork.delete({ where: { id } });

    await logAudit({
      userId: user.id,
      action: "schedule.deleted",
      resourceType: "scheduledWork",
      resourceId: id,
      schoolId: user.schoolId ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
