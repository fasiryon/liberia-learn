import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { buildStudentLearningIntelligence } from "@/lib/student/learningIntelligence";
import { buildStudentProgressSummary } from "@/lib/student/progressSummary";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    const [summary, learningIntelligence] = await Promise.all([
      buildStudentProgressSummary(user),
      buildStudentLearningIntelligence(user),
    ]);

    return NextResponse.json({
      ...summary,
      learningIntelligence,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load student progress" },
      { status: error?.status ?? 500 }
    );
  }
}
