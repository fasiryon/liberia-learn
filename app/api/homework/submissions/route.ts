// app/api/homework/submissions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

const CreateSchema = z.object({
  homeworkId: z.string().min(10),
  content: z.string().max(20000).optional().nullable(),
});

// GET /api/homework/submissions?homeworkId=...
// Tenant-safe: verifies homework -> class -> schoolId
export async function GET(req: Request) {
  const tenant = (await requireTenant()) as any;
  const schoolId: string = tenant.schoolId;

  const url = new URL(req.url);
  const homeworkId = url.searchParams.get("homeworkId");
  if (!homeworkId) {
    return NextResponse.json({ error: "Missing homeworkId" }, { status: 400 });
  }

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId, class: { schoolId } },
    select: { id: true },
  });
  if (!hw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.homeworkSubmission.findMany({
    where: { homeworkId },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      homeworkId: true,
      studentId: true,
      content: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, submissions: rows });
}

// POST /api/homework/submissions
// Body: { homeworkId, content? }
// Tenant-safe: verifies homework belongs to tenant schoolId.
// Uses current user as "studentId" (MVP). Later we can enforce role=STUDENT.
export async function POST(req: Request) {
  const tenant = (await requireTenant()) as any;
  const schoolId: string = tenant.schoolId;
  const userId: string | null = tenant.userId ?? tenant.currentUserId ?? null;

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { homeworkId, content } = parsed.data;

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId, class: { schoolId } },
    select: { id: true },
  });
  if (!hw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Upsert so same student can re-submit (updates their submission)
  const sub = await prisma.homeworkSubmission.upsert({
    where: { homeworkId_studentId: { homeworkId, studentId: userId } },
    update: { content: content ?? null, submittedAt: new Date() },
    create: { homeworkId, studentId: userId, content: content ?? null },
    select: {
      id: true,
      homeworkId: true,
      studentId: true,
      content: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, submission: sub }, { status: 201 });
}