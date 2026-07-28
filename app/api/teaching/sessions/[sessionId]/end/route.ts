import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildAndSaveLedger } from "@/lib/teaching/ledger";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await requireRole("TEACHER", "ADMIN");
  if (!user.schoolId) {
    return NextResponse.json(
      { error: "A school-scoped account is required" },
      { status: 403 }
    );
  }

  const { sessionId } = await params;
  const scope = {
    id: sessionId,
    schoolId: user.schoolId,
    ...(user.role === "TEACHER" ? { facilitatorId: user.id } : {}),
  };
  const session = await prisma.teachingSession.findFirst({
    where: scope,
    select: { id: true, status: true },
  });
  if (!session) {
    return NextResponse.json(
      { error: "Teaching session not found" },
      { status: 404 }
    );
  }

  if (session.status === "COMPLETED") {
    const existingLedger = await prisma.teachingLedger.findFirst({
      where: { sessionId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!existingLedger) {
      return NextResponse.json(
        { error: "Completed session ledger not found" },
        { status: 409 }
      );
    }
    return NextResponse.json({
      ledgerId: existingLedger.id,
      status: "COMPLETED",
    });
  }

  if (session.status === "ACTIVE") {
    const ending = await prisma.teachingSession.updateMany({
      where: { ...scope, status: "ACTIVE" },
      data: { status: "ENDING", endedAt: new Date() },
    });
    if (ending.count !== 1) {
      return NextResponse.json(
        { error: "Teaching session state changed" },
        { status: 409 }
      );
    }
  } else if (session.status !== "ENDING") {
    return NextResponse.json(
      { error: `Teaching session cannot end from status ${session.status}` },
      { status: 409 }
    );
  }

  const { ledgerId } = await buildAndSaveLedger(sessionId);
  const completed = await prisma.$transaction(async (tx) => {
    const updated = await tx.teachingSession.updateMany({
      where: { ...scope, status: "ENDING" },
      data: { status: "COMPLETED" },
    });
    if (updated.count !== 1) return false;

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "teaching.session.end",
        resourceId: sessionId,
        resourceType: "TeachingSession",
        schoolId: user.schoolId,
        details: { ledgerId },
      },
    });
    return true;
  });

  if (!completed) {
    return NextResponse.json(
      { error: "Teaching session completion conflict" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ledgerId, status: "COMPLETED" });
}
