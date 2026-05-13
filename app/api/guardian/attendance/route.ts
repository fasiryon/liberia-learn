import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireRole("GUARDIAN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const month = searchParams.get("month"); // YYYY-MM

  if (!studentId || !month) {
    return NextResponse.json({ error: "studentId and month are required" }, { status: 400 });
  }

  // Verify guardian is linked to student
  const link = await prisma.studentGuardian.findFirst({
    where: { guardianId: user.id, studentId },
  });
  if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [year, monthNum] = month.split("-").map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 1);

  const records = await prisma.attendance.findMany({
    where: {
      studentId,
      date: { gte: startDate, lt: endDate },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      status: true,
      classId: true,
      notes: true,
    },
  });

  return NextResponse.json(records);
}
