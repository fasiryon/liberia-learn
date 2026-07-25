import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isAbBlockSchedulingEnabled, isAssignmentLessonLinkageEnabled, isVirtualLabsEnabled } from "@/lib/serverFlags";
import { randomUUID } from "crypto";
import { readMoeAlignmentCodes } from "@/lib/moe/alignmentReader";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/curriculum/schedule
 * Body: { contentId, classId, scheduledDate, startTime?, endTime?, periodNumber?, classFormat? }
 * Creates a ScheduledWork entry (Today's Work) for a class.
 * Parts 2, 3, 5, 7: accepts new scheduling fields, A/B pairing, suggestion creation, lab binding.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const body = await req.json();
    const { contentId, classId, scheduledDate, startTime, endTime, periodNumber, classFormat } = body;

    if (!contentId || !classId || !scheduledDate) {
      return NextResponse.json(
        { error: "contentId, classId, and scheduledDate are required" },
        { status: 400 }
      );
    }

    // Verify class belongs to user's school
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true },
    });
    if (!cls || cls.schoolId !== user.schoolId) {
      return NextResponse.json(
        { error: "Class not found in your school" },
        { status: 404 }
      );
    }

    // Verify content exists and is published
    const content = await prisma.curriculumContent.findUnique({
      where: { contentId },
      select: { id: true, status: true, grade: true, subject: true, moeAlignments: true, payload: true, deliveryProfile: true },
    });
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }
    if (content.status !== "published") {
      return NextResponse.json(
        { error: "Content must be published before scheduling" },
        { status: 400 }
      );
    }

    // Part 3: A/B block pairing logic
    const isBlockFormat = classFormat === "block_a" || classFormat === "block_b";
    const deliveryProfile = content.deliveryProfile as any;
    const hasSplitPoint = deliveryProfile?.splitPoint != null;
    const shouldPair =
      isAbBlockSchedulingEnabled() && isBlockFormat && hasSplitPoint;

    const sessionPairId = shouldPair ? randomUUID() : undefined;

    // Part 7: virtual lab auto-binding
    let suggestedLabs: any = undefined;
    if (isVirtualLabsEnabled() && content.moeAlignments) {
      const codes = readMoeAlignmentCodes(content.moeAlignments);
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

    const record = await prisma.scheduledWork.create({
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
      },
    });

    // Part 3: create suggested sibling day for A/B block
    let suggestedPair: any = undefined;
    if (shouldPair) {
      const siblingDate = new Date(scheduledDate);
      siblingDate.setDate(siblingDate.getDate() + 2);
      const siblingFormat = classFormat === "block_a" ? "block_b" : "block_a";

      const sibling = await prisma.scheduledWork.create({
        data: {
          contentId,
          classId,
          scheduledDate: siblingDate,
          createdById: user.id,
          startTime: startTime ?? undefined,
          endTime: endTime ?? undefined,
          periodNumber: periodNumber ?? undefined,
          classFormat: siblingFormat,
          status: "suggested",
          sessionPairId,
          suggestedLabs: suggestedLabs ?? undefined,
        },
      });
      suggestedPair = {
        id: sibling.id,
        scheduledDate: sibling.scheduledDate,
        classFormat: sibling.classFormat,
        status: sibling.status,
      };
    }

    // Part 5: auto-create AssignmentSuggestion when exit ticket present
    if (isAssignmentLessonLinkageEnabled() && deliveryProfile?.exitTicket?.questions?.length) {
      const moeCodes = readMoeAlignmentCodes(content.moeAlignments);
      const title = (content.payload as any)?.title ?? "Lesson";
      const suggestedDue = new Date(scheduledDate);
      suggestedDue.setDate(suggestedDue.getDate() + 1);

      await prisma.assignmentSuggestion.create({
        data: {
          schoolId: user.schoolId!,
          contentId,
          scheduledWorkId: record.id,
          classId,
          suggestedTitle: `Check for Understanding: ${title}`,
          suggestedDueDate: suggestedDue,
          moeStandardCodes: moeCodes,
          status: "pending",
        },
      });
    }

    await logAudit({
      userId: user.id,
      action: "curriculum.schedule",
      resourceType: "curriculum",
      resourceId: contentId,
      details: { classId, scheduledDate, classFormat, sessionPairId },
      schoolId: user.schoolId ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      scheduledWorkId: record.id,
      ...(suggestedPair ? { suggestedPair } : {}),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to schedule" },
      { status: err?.status ?? 500 }
    );
  }
}
