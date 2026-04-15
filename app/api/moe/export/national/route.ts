import { NextResponse } from "next/server";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import {
  buildCsv,
  formatExportDate,
  getSchoolExportMetrics,
  requireMoeExportUser,
  schoolMetricsToCsvRows,
} from "@/lib/moe/exportUtils";
import { recordSloEvent } from "@/lib/slo/tracker";
import { logDataAccess } from "@/lib/dataAccess/logDataAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  if (!isMoePortalEnabled()) {
    return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
  }

  try {
    const user = await requireMoeExportUser();
    const exportDate = formatExportDate();
    const rows = schoolMetricsToCsvRows(await getSchoolExportMetrics(), exportDate);
    void logDataAccess({
      userId: user.id,
      schoolId: null,
      resourceType: "moe_export",
      resourceId: "national",
      action: "download",
      scope: "national",
    });
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

    recordSloEvent({
      service: "export",
      success: true,
      latencyMs: Date.now() - startedAt,
      schoolId: null,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="liberialearn-national-export-${exportDate}.csv"`,
      },
    });
  } catch (err: any) {
    recordSloEvent({
      service: "export",
      success: false,
      latencyMs: Date.now() - startedAt,
      schoolId: null,
    });
    return NextResponse.json(
      { error: err?.message ?? "Export failed" },
      { status: err?.status ?? 500 }
    );
  }
}
