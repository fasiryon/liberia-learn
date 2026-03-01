import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const traceId = randomUUID();
  try {
    const user = await requireRole("ADMIN");

    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const students = await prisma.student.findMany({
      where: {
        user: { schoolId: user.schoolId },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = students.map((s) => ({
      id: s.id,
      name: s.user.name ?? s.user.email,
      email: s.user.email,
    }));

    await logAudit({
      userId: user.id,
      action: "admin.students.listed",
      resourceType: "student_roster",
      schoolId: user.schoolId,
      traceId,
      details: { count: result.length },
    });

    return NextResponse.json({ students: result });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
