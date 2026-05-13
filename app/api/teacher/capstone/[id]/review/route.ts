import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/sendPush";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (user.role !== "TEACHER" && !user.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { decision, feedback } = body as { decision: "APPROVED" | "REJECTED"; feedback: string };

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }
  if (decision === "REJECTED" && !feedback?.trim()) {
    return NextResponse.json({ error: "Feedback is required when rejecting" }, { status: 400 });
  }

  const project = await (prisma as any).capstoneProject.findUnique({
    where: { id: params.id },
    select: { id: true, studentId: true, title: true, status: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Only SUBMITTED projects can be reviewed" }, { status: 400 });
  }

  const updated = await (prisma as any).capstoneProject.update({
    where: { id: params.id },
    data: {
      status: decision,
      teacherId: user.id,
      teacherFeedback: feedback ?? null,
      reviewedAt: new Date(),
    },
  });

  if (decision === "APPROVED") {
    await (prisma as any).portfolioItem.create({
      data: {
        studentId: project.studentId,
        kind: "CAPSTONE",
        title: project.title,
        capstoneProjectId: project.id,
      },
    });
  }

  const student = await prisma.student.findUnique({
    where: { id: project.studentId },
    select: { userId: true },
  });
  if (student) {
    const pushPayload =
      decision === "APPROVED"
        ? { title: "Your capstone was approved! 🎉", body: "Great work! Check your portfolio.", url: "/student/capstone" }
        : { title: "Your capstone needs revision", body: "Your teacher left feedback. Revise and resubmit.", url: "/student/capstone" };
    sendPushToUser(student.userId, pushPayload).catch(() => null);
  }

  return NextResponse.json(updated);
}
