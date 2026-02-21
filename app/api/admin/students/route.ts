import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");

    const students = await prisma.student.findMany({
      where: {
        user: { schoolId: user.schoolId },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = students.map((s) => ({
      id: s.id,
      name: s.user.name ?? s.user.email,
      email: s.user.email,
    }));

    return NextResponse.json({ students: result });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}

