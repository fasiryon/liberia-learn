import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireRole("ADMIN");
    const url = new URL(request.url);
    const schoolId = url.searchParams.get("schoolId") ?? user.schoolId;
    if (!schoolId) return NextResponse.json({ sentiment: null });

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await prisma.teacherSentiment.findMany({
      where: { schoolId, createdAt: { gte: cutoff } },
      select: { rating: true },
    });

    if (rows.length === 0) return NextResponse.json({ sentiment: null });

    const counts = rows.reduce(
      (acc, r) => {
        acc[r.rating as "good" | "okay" | "struggling"] =
          (acc[r.rating as "good" | "okay" | "struggling"] ?? 0) + 1;
        return acc;
      },
      { good: 0, okay: 0, struggling: 0 }
    );

    return NextResponse.json({ sentiment: counts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
