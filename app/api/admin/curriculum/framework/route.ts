import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  curriculumFramework,
  getSeniorSecondaryCoreSubjects,
  getSubjectMapByGrade,
  sampleCurriculumBlueprint,
} from "@/lib/curriculum/framework";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("ADMIN", "TEACHER");

    return NextResponse.json({
      ok: true,
      framework: curriculumFramework,
      subjectMapByGrade: getSubjectMapByGrade(),
      seniorSecondaryCoreSubjects: getSeniorSecondaryCoreSubjects(),
      sampleBlueprint: sampleCurriculumBlueprint,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load curriculum framework" },
      { status: error?.status ?? 500 }
    );
  }
}
