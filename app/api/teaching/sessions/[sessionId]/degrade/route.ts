import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DegradeSchema = z.object({
  reason: z.enum(["projector", "internet", "power"]),
});

const REASON_TO_MODE = {
  projector: "AUDIO_ONLY",
  internet: "WORKSHEET",
  power: "WORKSHEET",
} as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await requireRole("TEACHER", "ADMIN");
  if (!user.schoolId) {
    return NextResponse.json(
      { error: "A school-scoped account is required" },
      { status: 403 }
    );
  }

  const parsed = DegradeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid degradation reason" },
      { status: 400 }
    );
  }

  const { sessionId } = await params;
  const mode = REASON_TO_MODE[parsed.data.reason];
  const scope = {
    id: sessionId,
    schoolId: user.schoolId,
    ...(user.role === "TEACHER" ? { facilitatorId: user.id } : {}),
  };

  const recorded = await prisma.$transaction(async (tx) => {
    const updated = await tx.teachingSession.updateMany({
      where: scope,
      data: { degradedMode: mode },
    });
    if (updated.count !== 1) return false;

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "teaching.session.degrade",
        resourceId: sessionId,
        resourceType: "TeachingSession",
        schoolId: user.schoolId,
        details: {
          reason: parsed.data.reason,
          mode,
        },
      },
    });
    return true;
  });

  if (!recorded) {
    return NextResponse.json(
      { error: "Teaching session not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ mode, recorded: true });
}
