import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildPortfolioSummary } from "@/lib/portfolio/buildPortfolio";

export async function GET() {
  const user = await requireUser();
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const summary = await buildPortfolioSummary(student.id);
  return NextResponse.json(summary);
}
