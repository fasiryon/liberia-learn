import { NextResponse } from "next/server";
import { z } from "zod";
import "@/lib/agents/bootstrap";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runTeachingTurn } from "@/lib/teaching/runtime";

const TurnSchema = z.object({
  role: z.enum(["facilitator", "student"]),
  text: z.string().trim().min(1).max(2000),
  correct: z.boolean().nullable().optional(),
});

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

  const { sessionId } = await params;
  const session = await prisma.teachingSession.findFirst({
    where: {
      id: sessionId,
      schoolId: user.schoolId,
      ...(user.role === "TEACHER" ? { facilitatorId: user.id } : {}),
    },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json(
      { error: "Teaching session not found" },
      { status: 404 }
    );
  }

  const parsed = TurnSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid turn" }, { status: 400 });
  }

  try {
    const result = await runTeachingTurn(session.id, parsed.data, {
      userRole: user.role,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status =
      typeof (error as { status?: unknown })?.status === "number" &&
      (error as { status: number }).status >= 400 &&
      (error as { status: number }).status <= 599
        ? (error as { status: number }).status
        : 500;
    return NextResponse.json(
      {
        error:
          status === 503
            ? "Teaching runtime temporarily unavailable"
            : "Teaching turn failed",
      },
      { status }
    );
  }
}
