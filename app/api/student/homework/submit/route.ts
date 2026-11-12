// route-policy: auth=session; scope=record; authority=class-enrollment; rationale=only an active same-school student enrolled in the homework class may submit; redirects must be local before any submission write
import { requireTenant } from "@/lib/tenant";
// app/api/student/homework/submit/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
  const { schoolId } = await requireTenant();
  const user = await requireRole("STUDENT");
  if (!user.schoolId || user.schoolId !== schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findFirst({
    where: { userId: user.id, deletedAt: null, user: { schoolId } },
  });

  if (!student) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const formData = await req.formData();
  const homeworkId = formData.get("homeworkId");
  const rawRedirect = formData.get("redirectTo");
  if (rawRedirect !== null && typeof rawRedirect !== "string") return NextResponse.json({ error: "Invalid redirect" }, { status: 400 });
  const redirectTo = typeof rawRedirect === "string" && rawRedirect ? rawRedirect : "/assignments";
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//") || redirectTo.includes("\\")) {
    return NextResponse.json({ error: "Invalid redirect" }, { status: 400 });
  }
  const destination = new URL(redirectTo, req.url);
  if (destination.origin !== new URL(req.url).origin) return NextResponse.json({ error: "Invalid redirect" }, { status: 400 });

  if (typeof homeworkId !== "string" || !homeworkId) {
    return NextResponse.redirect(new URL("/assignments", req.url));
  }

  const homework = await prisma.homework.findFirst({ where: { id: homeworkId,
    Class: { schoolId, enrollments: { some: { studentId: student.id } } } } });
  if (!homework) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

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

  return NextResponse.redirect(destination);
  } catch (error: unknown) {
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: status >= 500 ? "Submission could not be saved" : error instanceof Error ? error.message : "Forbidden" }, { status });
  }
}
