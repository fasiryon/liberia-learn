import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isAssignmentLessonLinkageEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * POST /api/teacher/assignment-suggestions/[id]/accept
 * Part 5: Accept a pending assignment suggestion, creating an Assignment record.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAssignmentLessonLinkageEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { id } = params;

    const suggestion = await prisma.assignmentSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion || suggestion.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }
    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { error: `Suggestion is already ${suggestion.status}` },
        { status: 400 }
      );
    }

    // Create Assignment
    const assignment = await prisma.assignment.create({
      data: {
        classId: suggestion.classId,
        title: suggestion.suggestedTitle,
        dueAt: suggestion.suggestedDueDate,
        scheduledWorkId: suggestion.scheduledWorkId,
        contentId: suggestion.contentId,
        moeStandardCodes: suggestion.moeStandardCodes,
        generationMethod: "suggested",
      },
    });

    // Mark suggestion accepted
    await prisma.assignmentSuggestion.update({
      where: { id },
      data: { status: "accepted" },
    });

    await logAudit({
      userId: user.id,
      action: "assignment.suggestion.accepted",
      resourceType: "assignmentSuggestion",
      resourceId: id,
      details: { assignmentId: assignment.id, classId: suggestion.classId },
      schoolId: user.schoolId ?? undefined,
    });

    return NextResponse.json({ assignment });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to accept suggestion" },
      { status: err?.status ?? 500 }
    );
  }
}
