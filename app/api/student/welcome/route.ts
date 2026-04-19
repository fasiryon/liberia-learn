import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireRole("STUDENT");
    const completedAt = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: { welcomeCompletedAt: completedAt },
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      action: "student.welcome.completed",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.json({ ok: true, completedAt: completedAt.toISOString() });
  } catch (error) {
    return handleApiError(error, { route: "/api/student/welcome", method: "POST" });
  }
}
