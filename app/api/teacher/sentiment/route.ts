import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_RATINGS = new Set(["good", "okay", "struggling"]);

export async function POST(request: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const { rating } = body as { rating?: string };

    if (!rating || !VALID_RATINGS.has(rating)) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }

    await prisma.teacherSentiment.create({
      data: { teacherId: user.id, schoolId: user.schoolId, rating },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
