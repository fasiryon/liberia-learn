import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");

    const progress = await prisma.studentProgress.findMany({
      where: { studentId: user.id },
      include: {
        scheduledWork: {
          include: {
            content: { select: { subject: true, contentType: true, payload: true } },
            class: { select: { schoolId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Tenant isolation filter
    const filtered = progress.filter((p) => p.scheduledWork.class.schoolId === user.schoolId);

    const records = filtered.map((p) => {
      const payload = p.scheduledWork.content.payload as any;
      return {
        id: p.id,
        scheduledWorkId: p.scheduledWorkId,
        title: resolveLessonTitle({
          payload,
          subject: String(p.scheduledWork.content.subject),
        }),
        subject: p.scheduledWork.content.subject,
        completedAt: p.completedAt,
        startedAt: p.startedAt,
      };
    });

    return NextResponse.json({ records });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
