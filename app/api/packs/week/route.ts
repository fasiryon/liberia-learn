import { NextRequest, NextResponse } from "next/server";
import { getDownloadUrl } from "@vercel/blob";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generatePack, resolveWeekBounds } from "@/lib/packs/generatePack";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await requireRole("TEACHER", "STUDENT", "ADMIN");
  const body = await req.json().catch(() => ({})) as {
    classId?: string;
    weekStart?: string;
    audience?: "student" | "teacher";
  };

  const { weekStart, weekEnd } = resolveWeekBounds(body.weekStart);
  const audience = body.audience ?? (user.role === "TEACHER" || user.role === "ADMIN" ? "teacher" : "student");

  // Resolve classId for student packs
  let classId = body.classId ?? null;
  let studentId: string | null = null;

  if (user.role === "STUDENT" && !classId) {
    // Use first active enrollment for the student
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true, enrollments: { take: 1, select: { classId: true } } },
    });
    classId = student?.enrollments[0]?.classId ?? null;
    studentId = student?.id ?? null;
  }

  const pack = await prisma.offlinePack.create({
    data: {
      requestedById: user.id,
      classId,
      studentId,
      weekStart,
      weekEnd,
      audience,
      status: "pending",
    },
  });

  try {
    const result = await generatePack(pack.id);
    return NextResponse.json({
      packId: result.packId,
      status: "ready",
      downloadUrl: getDownloadUrl(result.blobUrl),
      sizeBytes: result.sizeBytes,
      lessonCount: result.lessonCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Pack generation failed" },
      { status: err?.status ?? 500 }
    );
  }
}
