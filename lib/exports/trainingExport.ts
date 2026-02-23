import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getTrainingSummary } from "@/lib/reporting/training";
import type { ReportScope } from "@/lib/reporting/scope";
import { recordMetricEvent } from "@/lib/metrics/events";

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => row.map(escape).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function buildTrainingExport({
  userId,
  scope,
  scopeId,
  pilotOnly,
  format,
}: {
  userId: string | null;
  scope: ReportScope;
  scopeId: string | null;
  pilotOnly: boolean;
  format: "csv" | "json";
}) {
  try {
    const summary = await getTrainingSummary({ scope, scopeId, pilotOnly });

    const exportRecord = await prisma.exportRecord.create({
      data: {
        userId,
        exportType: "training_summary",
        scope,
        scopeId,
        filters: { pilotOnly },
        format,
        pilotOnly,
      },
    });

    await logAudit({
      userId,
      action: "export.training.summary",
      resourceType: "export",
      resourceId: exportRecord.id,
      details: {
        scope,
        scopeId,
        exportType: "training_summary",
        filters: { pilotOnly },
        format,
      },
    });

    await recordMetricEvent(
      "export.generated",
      {
        exportType: "training_summary",
        format,
      },
      {
        scope,
        scopeId,
        schoolId: scope === "school" ? scopeId : null,
        userId,
        severity: "info",
        kind: "counter",
        pilotOnly,
      }
    );

    if (format === "json") {
      return {
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(summary),
      };
    }

    const totalsRows = [
      ["Teachers", String(summary.totals.teachers)],
      ["Modules", String(summary.totals.modules)],
      ["Assigned", String(summary.totals.assigned)],
      ["Completed", String(summary.totals.completed)],
      ["In Progress", String(summary.totals.inProgress)],
      ["Not Started", String(summary.totals.notStarted)],
      ["Completion Rate", String(summary.totals.completionRate)],
    ];

    const moduleRows = summary.modules.map((m) => [
      m.code,
      m.title,
      String(m.total),
      String(m.completed),
      String(m.inProgress),
      String(m.notStarted),
      String(m.completionRate),
    ]);

    const csv = [
      toCSV(["Metric", "Value"], totalsRows),
      "",
      toCSV(
        ["Module Code", "Module Title", "Total", "Completed", "In Progress", "Not Started", "Completion Rate"],
        moduleRows
      ),
    ].join("\n");

    return {
      contentType: "text/csv; charset=utf-8",
      body: csv,
    };
  } catch (err: any) {
    try {
      await recordMetricEvent(
        "export.failed",
        {
          exportType: "training_summary",
          error: err?.message ?? "unknown",
        },
        {
          scope,
          scopeId,
          schoolId: scope === "school" ? scopeId : null,
          userId,
          severity: "error",
          kind: "counter",
          pilotOnly,
        }
      );
    } catch {
      // Metrics failure should not hide the export failure.
    }
    throw err;
  }
}

