import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const today = new Date();
    const briefDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const brief = await prisma.teacherMorningBrief.findUnique({
      where: { teacherUserId_briefDate: { teacherUserId: user.id, briefDate } },
      select: { briefText: true, createdAt: true },
    });

    return NextResponse.json(
      { brief: brief ? { briefText: brief.briefText, createdAt: brief.createdAt } : null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load brief" }, { status: err?.status ?? 500 });
  }
}
