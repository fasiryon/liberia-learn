import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/labs/[labId]/session
 * Part 7: Start a virtual lab session for a student.
 * Validates that the student has a pre-created LabSession for this lab.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { labId: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("STUDENT");
    const { labId } = params;

    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    // Find the existing session created by the teacher link action
    const session = await prisma.labSession.findFirst({
      where: {
        labId,
        studentId: user.id,
        schoolId: user.schoolId,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "No session found for this lab" }, { status: 404 });
    }

    // If already started, just return the session
    if (session.completedAt) {
      return NextResponse.json({ session });
    }

    // Update startedAt if this is the first access
    const updated = await prisma.labSession.update({
      where: { id: session.id },
      data: { startedAt: new Date() },
    });

    await logAudit({
      userId: user.id,
      action: "lab.session.start",
      resourceType: "labSession",
      resourceId: session.id,
      schoolId: user.schoolId,
      details: { labId },
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to start session" },
      { status: err?.status ?? 500 }
    );
  }
}
