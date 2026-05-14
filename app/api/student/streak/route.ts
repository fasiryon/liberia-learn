import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");

    const streak = await prisma.studentStreak.findUnique({
      where: { studentId: user.id },
      select: { currentStreak: true, longestStreak: true, optOut: true },
    });

    return NextResponse.json({
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      optOut: streak?.optOut ?? false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const body = await req.json().catch(() => ({}));
    const optOut = typeof body.optOut === "boolean" ? body.optOut : undefined;

    if (optOut === undefined) {
      return NextResponse.json({ error: "optOut field required" }, { status: 400 });
    }

    const streak = await prisma.studentStreak.upsert({
      where: { studentId: user.id },
      create: { studentId: user.id, optOut },
      update: { optOut },
      select: { currentStreak: true, longestStreak: true, optOut: true },
    });

    return NextResponse.json(streak);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
