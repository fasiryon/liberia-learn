import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  assertPermission: vi.fn(),
  buildSchoolOneRosterData: vi.fn(),
  buildOneRosterZip: vi.fn(),
  parseOneRosterZip: vi.fn(),
  createOneRosterImportBatch: vi.fn(),
  buildXapiExport: vi.fn(),
  logAudit: vi.fn(),
  logDataAccess: vi.fn(),
  exportRecordCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/permissions", () => ({
  assertPermission: mocks.assertPermission,
  PERMISSIONS: { GOVERNANCE_EXPORT_SCHOOL: "governance.export.school" },
}));
vi.mock("@/lib/db", () => ({
  prisma: { exportRecord: { create: mocks.exportRecordCreate } },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/dataAccess/logDataAccess", () => ({ logDataAccess: mocks.logDataAccess }));
vi.mock("@/lib/interoperability/oneroster", () => ({
  buildOneRosterZip: mocks.buildOneRosterZip,
  parseOneRosterZip: mocks.parseOneRosterZip,
}));
vi.mock("@/lib/interoperability/onerosterService", () => ({
  buildSchoolOneRosterData: mocks.buildSchoolOneRosterData,
  createOneRosterImportBatch: mocks.createOneRosterImportBatch,
}));
vi.mock("@/lib/interoperability/xapiExport", () => ({ buildXapiExport: mocks.buildXapiExport }));

import { GET as exportOneRoster } from "@/app/api/admin/interoperability/oneroster/export/route";
import { POST as importOneRoster } from "@/app/api/admin/interoperability/oneroster/import/route";
import { GET as exportXapi } from "@/app/api/admin/interoperability/xapi/export/route";

const ADMIN = {
  id: "admin-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

const VALID_PARSE = {
  valid: true,
  counts: {
    manifest: 25,
    orgs: 1,
    academicSessions: 1,
    courses: 1,
    classes: 1,
    users: 2,
    roles: 2,
    enrollments: 2,
    demographics: 0,
  },
  rows: {
    orgs: [{ sourcedId: "school-1", name: "School", type: "school" }],
    academicSessions: [],
    courses: [],
    classes: [],
    users: [],
    roles: [],
    enrollments: [],
    demographics: [],
  },
  errors: [],
  warnings: [],
};

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function importRequest(mode: "preview" | "commit", schoolId?: string) {
  const form = new FormData();
  form.set("mode", mode);
  form.set("file", new File([new Uint8Array([80, 75, 3, 4])], "roster.zip", { type: "application/zip" }));
  if (schoolId) form.set("schoolId", schoolId);
  return new NextRequest("http://localhost/api/admin/interoperability/oneroster/import", {
    method: "POST",
    body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.XAPI_EXPORT_PSEUDONYM_SECRET = "test-interoperability-secret-32-chars";
  mocks.requireUser.mockResolvedValue(ADMIN);
  mocks.exportRecordCreate.mockResolvedValue({ id: "export-1" });
  mocks.logAudit.mockResolvedValue(undefined);
  mocks.logDataAccess.mockResolvedValue(undefined);
  mocks.buildSchoolOneRosterData.mockResolvedValue({ users: [{ id: "u" }], classes: [{ id: "c" }], enrollments: [{ id: "e" }] });
  mocks.buildOneRosterZip.mockResolvedValue(new Uint8Array([80, 75, 3, 4]));
  mocks.parseOneRosterZip.mockResolvedValue(VALID_PARSE);
  mocks.createOneRosterImportBatch.mockResolvedValue({ batchId: "batch-1", status: "QUEUED", accepted: 55 });
  mocks.buildXapiExport.mockResolvedValue([{ id: "statement-1" }]);
});

describe("interoperability admin routes", () => {
  it("denies a non-admin before generating an export", async () => {
    mocks.requireUser.mockResolvedValue({ ...ADMIN, role: "TEACHER" });

    const response = await exportXapi(
      request("/api/admin/interoperability/xapi/export?since=2026-07-01&until=2026-07-21")
    );

    expect(response.status).toBe(403);
    expect(mocks.buildXapiExport).not.toHaveBeenCalled();
  });

  it("rejects a school admin requesting another school's xAPI events", async () => {
    const response = await exportXapi(
      request("/api/admin/interoperability/xapi/export?since=2026-07-01&until=2026-07-21&schoolId=school-2")
    );

    expect(response.status).toBe(403);
    expect(mocks.buildXapiExport).not.toHaveBeenCalled();
  });

  it("exports school-scoped xAPI JSON with protocol and audit metadata", async () => {
    const response = await exportXapi(
      request("/api/admin/interoperability/xapi/export?since=2026-07-01&until=2026-07-21&source=performance&limit=40")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-experience-api-version")).toBe("1.0.3");
    expect(response.headers.get("x-statement-count")).toBe("1");
    expect(mocks.buildXapiExport).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school-1",
      source: "performance",
      limit: 40,
    }));
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "school-1" }));
    expect(mocks.logDataAccess).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "school-1" }));
  });

  it("exports a school-scoped OneRoster ZIP and records that it contains PII", async () => {
    const response = await exportOneRoster(request("/api/admin/interoperability/oneroster/export"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.buildSchoolOneRosterData).toHaveBeenCalledWith("school-1");
    expect(mocks.exportRecordCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scopeId: "school-1", filters: expect.objectContaining({ piiIncluded: true }) }),
    }));
  });

  it("validates a OneRoster preview without creating an import batch", async () => {
    const response = await importOneRoster(importRequest("preview"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.preview).toMatchObject({ valid: true, counts: { users: 2, classes: 1, enrollments: 2 } });
    expect(mocks.createOneRosterImportBatch).not.toHaveBeenCalled();
  });

  it("refuses to commit an invalid OneRoster package", async () => {
    mocks.parseOneRosterZip.mockResolvedValue({
      ...VALID_PARSE,
      valid: false,
      errors: [{ code: "MISSING_REFERENCE", message: "Unknown class", file: "enrollments.csv", row: 2 }],
    });

    const response = await importOneRoster(importRequest("commit"));

    expect(response.status).toBe(422);
    expect(mocks.createOneRosterImportBatch).not.toHaveBeenCalled();
  });

  it("rejects a cross-school OneRoster import before parsing or writing", async () => {
    const response = await importOneRoster(importRequest("commit", "school-2"));

    expect(response.status).toBe(403);
    expect(mocks.parseOneRosterZip).not.toHaveBeenCalled();
    expect(mocks.createOneRosterImportBatch).not.toHaveBeenCalled();
  });

  it("creates a tenant-scoped import batch for a valid committed package", async () => {
    const response = await importOneRoster(importRequest("commit"));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ batchId: "batch-1", status: "QUEUED", accepted: 55 });
    expect(mocks.createOneRosterImportBatch).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "admin-1",
      schoolId: "school-1",
      fileName: "roster.zip",
      parsed: VALID_PARSE,
    }));
  });
});
