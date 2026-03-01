import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAssignmentLessonLinkageEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * POST /api/teacher/assignment-suggestions/[id]/dismiss
 * Part 5: Dismiss a pending assignment suggestion.
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

    await prisma.assignmentSuggestion.update({
      where: { id },
      data: { status: "dismissed" },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to dismiss suggestion" },
      { status: err?.status ?? 500 }
    );
  }
}
