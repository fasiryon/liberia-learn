import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireRole("ADMIN");
  if (!user.schoolId) {
    return NextResponse.json({ error: "School context required" }, { status: 400 });
  }

  const credentials = await prisma.portfolioCredential.findMany({
    where: { student: { schoolId: user.schoolId } },
    orderBy: { generatedAt: "desc" },
    select: {
      id: true,
      studentId: true,
      studentName: true,
      grade: true,
      term: true,
      avgScore: true,
      attendance: true,
      lessonsComplete: true,
      blobUrl: true,
      verifyToken: true,
      generatedAt: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({ credentials });
}
