import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    await requirePlatformAdmin();

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    // Get today's MCA scheduled work
    const todayWork = await prisma.scheduledWork.findMany({
      where: {
        class: { schoolId: "school_mca" },
        scheduledDate: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        class: {
          include: {
            enrollments: {
              include: { Student: { include: { user: true } } },
            },
          },
        },
      },
    });

    let created = 0;
    for (const sw of todayWork) {
      const students = sw.class.enrollments.map((e) => e.Student.user);
      const toComplete = Math.ceil(students.length * 0.6);

      for (let i = 0; i < toComplete && i < students.length; i++) {
        try {
          await prisma.studentProgress.upsert({
            where: { studentId_scheduledWorkId: { studentId: students[i].id, scheduledWorkId: sw.id } },
            create: { studentId: students[i].id, scheduledWorkId: sw.id, startedAt: now, completedAt: now },
            update: { completedAt: now },
          });
          created++;
        } catch {}
      }
    }

    return NextResponse.json({ created, message: `Simulated ${created} completions for Monrovia Central Academy` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
