// app/api/grading/compute/route.ts
// FIXED: was completely unauthenticated.
// Now: TEACHER or ADMIN only.
// NOTE: School isolation enforcement is Sprint 2 (needs User.schoolId).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { computeStudentGradebook } from "@/src/server/grading/gradebook";

export async function POST(req: Request) {
  try {
    await requireRole("TEACHER", "ADMIN");

    const body = await req.json();
    const classId   = String(body?.classId   ?? "");
    const studentId = String(body?.studentId ?? "");

    if (!classId || !studentId) {
      return NextResponse.json(
        { ok: false, error: "classId and studentId are required" },
        { status: 400 }
      );
    }

    const result = await computeStudentGradebook(prisma, classId, studentId);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: err?.status ?? 500 }
    );
  }
}