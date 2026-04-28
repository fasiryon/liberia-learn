import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getYearReadinessReport, mapExistingCurriculumToYearPlan } from "@/lib/curriculum/yearPlan";

export const dynamic = "force-dynamic";

async function requireCurriculumReadinessAccess() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN" && user.role !== "MOE_OFFICIAL") {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

function toCsv(rows: Awaited<ReturnType<typeof getYearReadinessReport>>) {
  const header = [
    "grade",
    "subject",
    "readinessPct",
    "totalLessons",
    "mappedLessons",
    "weeksCovered",
    "unitsCovered",
    "missingWeekCount",
    "missingAssessments",
    "missingTeacherGuides",
    "missingWorksheets",
    "missingAudio",
    "missingLabs",
    "classification",
  ];
  const body = rows.map((row) => [
    row.grade,
    row.subject,
    row.readinessPct,
    row.totalLessons,
    row.mappedLessons,
    row.weeksCovered,
    row.unitsCovered,
    row.missingWeeks.length,
    row.missingAssessments,
    row.missingTeacherGuides,
    row.missingWorksheets,
    row.missingAudio,
    row.missingLabs,
    row.classification,
  ].join(","));
  return [header.join(","), ...body].join("\n");
}

export async function GET(req: NextRequest) {
  try {
    await requireCurriculumReadinessAccess();
    const rows = await getYearReadinessReport();
    if (req.nextUrl.searchParams.get("format") === "csv") {
      return new NextResponse(toCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=curriculum-year-readiness.csv",
        },
      });
    }
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      targets: {
        weeksPerGradeSubject: 36,
        lessonsPerWeek: 5,
        lessonsPerGradeSubject: 180,
      },
      rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load readiness" }, { status: err?.status ?? 500 });
  }
}

export async function POST() {
  try {
    const user = await requireCurriculumReadinessAccess();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await mapExistingCurriculumToYearPlan();
    const rows = await getYearReadinessReport();
    return NextResponse.json({
      ok: true,
      generatedContent: false,
      duplicatedLessons: false,
      mappedLessons: result.mappedLessons,
      decisionCount: result.decisions.length,
      rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to map curriculum" }, { status: err?.status ?? 500 });
  }
}
