import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const user = await requireUser();
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const existing = await (prisma as any).portfolioShare.findFirst({
    where: { studentId: student.id, isActive: true },
    select: { shareCode: true },
  });

  const shareCode = existing?.shareCode ?? (await (async () => {
    const created = await (prisma as any).portfolioShare.create({
      data: { studentId: student.id },
      select: { shareCode: true },
    });
    return created.shareCode;
  })());

  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://liberia-learn.vercel.app";

  return NextResponse.json({ shareCode, shareUrl: `${base}/portfolio/${shareCode}` });
}
