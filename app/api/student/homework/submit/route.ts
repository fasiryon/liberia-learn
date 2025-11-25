// app/api/student/homework/submit/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as any;

  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const userId = session.user.id as string;

  const student = await prisma.student.findFirst({
    where: { userId },
  });

  if (!student) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const formData = await req.formData();
  const homeworkId = formData.get("homeworkId") as string | null;
  const redirectTo =
    (formData.get("redirectTo") as string | null) || "/assignments";

  if (!homeworkId) {
    return NextResponse.redirect(new URL("/assignments", req.url));
  }

  const answers: string[] = [];

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer_")) {
      const idx = parseInt(key.split("_")[1] || "0", 10);
      answers[idx] = String(value);
    }
  }

  await prisma.homeworkSubmission.upsert({
    where: {
      homeworkId_studentId: {
        homeworkId,
        studentId: student.id,
      },
    },
    create: {
      homeworkId,
      studentId: student.id,
      answers,
      submittedAt: new Date(),
    },
    update: {
      answers,
      submittedAt: new Date(),
    },
  });

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
