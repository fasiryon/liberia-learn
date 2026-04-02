import { NextResponse } from "next/server";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import {
  buildCsv,
  formatExportDate,
  getSchoolExportMetrics,
  requireMoeExportUser,
  schoolMetricsToCsvRows,
} from "@/lib/moe/exportUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isMoePortalEnabled()) {
    return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
  }

  try {
    await requireMoeExportUser();
    const exportDate = formatExportDate();
    const rows = schoolMetricsToCsvRows(await getSchoolExportMetrics(), exportDate);
    const csv = buildCsv(
      [
        "School Name",
        "County",
        "District",
        "Total Students",
        "Active Students (last 30 days)",
        "Avg Lesson Completion %",
        "Avg Exam Score",
        "Placement Tests Completed",
        "Intervention Rate %",
        "Guardian Engagement %",
        "Export Date",
      ],
      rows
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="liberialearn-national-export-${exportDate}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Export failed" },
      { status: err?.status ?? 500 }
    );
  }
}
