import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await requireUser();
  if (user.role !== "TEACHER" && !user.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!user.schoolId) return NextResponse.json([]);

  const projects = await (prisma as any).capstoneProject.findMany({
    where: {
      Student: { user: { schoolId: user.schoolId } },
      status: { in: ["SUBMITTED", "APPROVED", "REJECTED"] },
    },
    include: {
      Student: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json(
    projects.map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      skills: p.skills,
      fileUrls: p.fileUrls,
      status: p.status,
      submittedAt: p.submittedAt,
      reviewedAt: p.reviewedAt,
      teacherFeedback: p.teacherFeedback,
      studentName: p.Student?.user?.name ?? null,
      gradeLevel: p.Student?.currentGrade ?? null,
    }))
  );
}
