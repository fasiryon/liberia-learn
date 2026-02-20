import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/pilot-dashboard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pilot-dashboard")>(
    "@/lib/pilot-dashboard"
  );
  return {
    ...actual,
    getPilotDashboardRows: vi.fn(),
  };
});

import { GET } from "@/app/api/platform/reports/route";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  buildPilotDashboardCsvRows,
  getPilotDashboardRows,
  pilotDashboardHeaders,
} from "@/lib/pilot-dashboard";

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => row.map(escape).join(","));
  return [headerLine, ...dataLines].join("\n");
}

describe("platform reports pilot export", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns CSV that matches dashboard rows", async () => {
    (requirePlatformAdmin as any).mockResolvedValue({ id: "admin-1" });
    const mockRows = [
      {
        id: "s1",
        schoolName: "Pilot One",
        county: "Montserrado",
        onboardingStatus: "Step 3/5",
        readinessScore: 77,
        pilotStatus: "ACTIVE",
        pilotCohort: "2026-A",
        contactEmailVerified: true,
        contactPhoneVerified: false,
      },
      {
        id: "s2",
        schoolName: "Pilot Two",
        county: "Bong",
        onboardingStatus: "Complete",
        readinessScore: 92,
        pilotStatus: "ACTIVE",
        pilotCohort: "2026-B",
        contactEmailVerified: false,
        contactPhoneVerified: true,
      },
    ];
    (getPilotDashboardRows as any).mockResolvedValue(mockRows);

    const req = new Request(
      "http://localhost/api/platform/reports?type=pilot&format=csv"
    );
    const res = await GET(req as any);
    const text = await res.text();

    const expectedRows = buildPilotDashboardCsvRows(mockRows);
    const expectedCsv = toCSV(pilotDashboardHeaders, expectedRows);

    expect(res.status).toBe(200);
    expect(text).toBe(expectedCsv);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "pilot.export",
        details: expect.objectContaining({ rowCount: 2, schoolIds: ["s1", "s2"] }),
      })
    );
  });

  it("rejects non-admin export", async () => {
    (requirePlatformAdmin as any).mockRejectedValue({ status: 403, message: "Forbidden" });

    const req = new Request(
      "http://localhost/api/platform/reports?type=pilot&format=csv"
    );
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
    expect(logAudit).not.toHaveBeenCalled();
  });
});
