import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildPortfolioSummary } from "@/lib/portfolio/buildPortfolio";

export async function GET(_req: NextRequest, { params }: { params: { shareCode: string } }) {
  const share = await (prisma as any).portfolioShare.findUnique({
    where: { shareCode: params.shareCode },
    select: { studentId: true, isActive: true },
  });

  if (!share || !share.isActive) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const summary = await buildPortfolioSummary(share.studentId);

  return NextResponse.json({
    firstName: summary.firstName,
    gradeLevel: summary.gradeLevel,
    schoolName: summary.schoolName,
    lessonsCompleted: summary.lessonsCompleted,
    quizAverage: summary.quizAverage,
    certificatesEarned: summary.certificatesEarned,
    badgesEarned: summary.badgesEarned,
    labSessions: summary.labSessions,
    dayStreak: summary.dayStreak,
    badges: summary.badges,
    subjectsStudied: summary.subjectsStudied,
  });
}
