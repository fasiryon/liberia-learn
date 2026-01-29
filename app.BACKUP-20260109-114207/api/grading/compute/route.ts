// app/api/grading/compute/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { computeStudentGradebook } from "@/src/server/grading/gradebook";

const prisma = new PrismaClient();

/**
 * POST /api/grading/compute
 * body: { classId: string, studentId: string }
 *
 * Returns:
 * - computed gradebook result (overall + category breakdown)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const classId = String(body?.classId ?? "");
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
      { status: 500 }
    );
  }
}


