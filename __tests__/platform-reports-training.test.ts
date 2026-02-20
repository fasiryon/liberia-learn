import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/training-report", async () => {
  const actual = await vi.importActual<typeof import("@/lib/training-report")>(
    "@/lib/training-report"
  );
  return {
    ...actual,
    getTrainingReportRows: vi.fn(),
  };
});

import { GET } from "@/app/api/platform/reports/route";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  buildTrainingReportCsvRows,
  getTrainingReportRows,
  trainingReportHeaders,
} from "@/lib/training-report";

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => row.map(escape).join(","));
  return [headerLine, ...dataLines].join("\n");
}

describe("platform reports training export", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns JSON for training report and defaults to pilot only", async () => {
    (requirePlatformAdmin as any).mockResolvedValue({ id: "admin-1" });
    (getTrainingReportRows as any).mockResolvedValue([
      {
        teacherId: "t1",
        teacherName: "Teacher One",
        schoolId: "s1",
        schoolName: "Pilot School",
        county: "Montserrado",
        completedModules: 2,
        totalModules: 3,
        completionPct: 67,
        lastActivity: new Date("2026-02-20T00:00:00.000Z"),
      },
    ]);

    const req = new Request("http://localhost/api/platform/reports?type=training");
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.type).toBe("training");
    expect(getTrainingReportRows).toHaveBeenCalledWith({ schoolId: null, pilotOnly: true });
  });

  it("returns CSV and logs export", async () => {
    (requirePlatformAdmin as any).mockResolvedValue({ id: "admin-1" });
    const rows = [
      {
        teacherId: "t1",
        teacherName: "Teacher One",
        schoolId: "s1",
        schoolName: "Pilot School",
        county: "Montserrado",
        completedModules: 2,
        totalModules: 3,
        completionPct: 67,
        lastActivity: new Date("2026-02-20T00:00:00.000Z"),
      },
    ];
    (getTrainingReportRows as any).mockResolvedValue(rows);

    const req = new Request("http://localhost/api/platform/reports?type=training&format=csv&pilotOnly=false");
    const res = await GET(req as any);
    const text = await res.text();

    const expectedRows = buildTrainingReportCsvRows(rows);
    const expectedCsv = toCSV(trainingReportHeaders, expectedRows);

    expect(res.status).toBe(200);
    expect(text).toBe(expectedCsv);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "training.export",
        details: expect.objectContaining({ rowCount: 1, schoolIds: ["s1"] }),
      })
    );
  });

  it("rejects non-admin access", async () => {
    (requirePlatformAdmin as any).mockRejectedValue({ status: 403, message: "Forbidden" });

    const req = new Request("http://localhost/api/platform/reports?type=training&format=csv");
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
    expect(logAudit).not.toHaveBeenCalled();
  });
});
