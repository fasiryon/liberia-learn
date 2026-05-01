import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { buildStudentLearningIntelligence } from "@/lib/student/learningIntelligence";
import { buildStudentProgressSummary } from "@/lib/student/progressSummary";
import { prisma } from "@/lib/db";
import { buildStudentSkillBadges } from "@/lib/badges/studentBadges";
import { buildStudentExamReadiness } from "@/lib/outcomes/examReadiness";
import { buildPathwayHooks } from "@/lib/outcomes/pathways";

export const dynamic = "force-dynamic";

function isOutcomeFlagEnabled(name: string) {
  return process.env[name] !== "false";
}

export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    const [summary, learningIntelligence, badges, examReadiness] = await Promise.all([
      buildStudentProgressSummary(user),
      buildStudentLearningIntelligence(user),
      student && isOutcomeFlagEnabled("ENABLE_SKILL_BADGES")
        ? buildStudentSkillBadges(student.id).catch(() => [])
        : Promise.resolve([]),
      student && isOutcomeFlagEnabled("ENABLE_EXAM_READINESS")
        ? buildStudentExamReadiness(student.id).catch(() => null)
        : Promise.resolve(null),
    ]);
    const pathwayHooks =
      isOutcomeFlagEnabled("ENABLE_PATHWAY_HOOKS") && examReadiness
        ? buildPathwayHooks(examReadiness, badges)
        : [];

    return NextResponse.json({
      ...summary,
      learningIntelligence,
      badges,
      examReadiness,
      pathwayHooks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load student progress" },
      { status: error?.status ?? 500 }
    );
  }
}
