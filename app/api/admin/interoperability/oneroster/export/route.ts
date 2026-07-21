import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { logDataAccess } from "@/lib/dataAccess/logDataAccess";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { buildOneRosterZip } from "@/lib/interoperability/oneroster";
import { buildSchoolOneRosterData } from "@/lib/interoperability/onerosterService";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    assertPermission(user, PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL);
    const requestedSchoolId = new URL(req.url).searchParams.get("schoolId")?.trim() || undefined;
    const schoolId = resolveAdminSchoolScope(user, requestedSchoolId);
    const data = await buildSchoolOneRosterData(schoolId);
    const zip = await buildOneRosterZip(data);

    const exportRecord = await prisma.exportRecord.create({
      data: {
        userId: user.id,
        exportType: "oneroster_1_2_roster",
        scope: "school",
        scopeId: schoolId,
        filters: {
          users: data.users.length,
          classes: data.classes.length,
          enrollments: data.enrollments.length,
          piiIncluded: true,
        },
        format: "zip",
        pilotOnly: false,
      },
      select: { id: true },
    });
    await Promise.all([
      logAudit({
        userId: user.id,
        schoolId,
        action: "admin.interoperability.oneroster.exported",
        resourceType: "export",
        resourceId: exportRecord.id,
        traceId,
        details: { users: data.users.length, classes: data.classes.length, enrollments: data.enrollments.length },
      }),
      logDataAccess({
        userId: user.id,
        schoolId,
        resourceType: "school_roster",
        resourceId: exportRecord.id,
        action: "export",
        scope: "school",
        traceId,
        metadata: { format: "oneroster-1.2.1-csv", piiIncluded: true },
      }),
    ]);

    const filename = `liberialearn-oneroster-${new Date().toISOString().slice(0, 10)}.zip`;
    return new NextResponse(zip as BodyInit, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zip.byteLength),
        "Content-Type": "application/zip",
        "X-Request-Id": traceId,
      },
    });
  } catch (error) {
    return handleApiError(error, { requestId: traceId, route: "/api/admin/interoperability/oneroster/export", method: "GET" });
  }
}
