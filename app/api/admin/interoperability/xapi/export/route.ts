import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { logDataAccess } from "@/lib/dataAccess/logDataAccess";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { buildXapiExport } from "@/lib/interoperability/xapiExport";
import { XAPI_VERSION } from "@/lib/interoperability/xapi";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["all", "learning", "performance"]).default("all"),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

function pseudonymSecret() {
  const secret =
    process.env.XAPI_EXPORT_PSEUDONYM_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    (process.env.NODE_ENV === "test" ? "test-only-xapi-pseudonym-secret" : "");
  if (secret.length < 16) {
    throw Object.assign(new Error("xAPI pseudonymization is not configured"), { status: 503 });
  }
  return secret;
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    assertPermission(user, PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL);

    const raw = Object.fromEntries(new URL(req.url).searchParams.entries());
    const query = querySchema.parse(raw);
    const schoolId = resolveAdminSchoolScope(user, query.schoolId);
    const since = new Date(`${query.since}T00:00:00.000Z`);
    const until = new Date(`${query.until}T23:59:59.999Z`);
    if (since > until) {
      throw Object.assign(new Error("since must be on or before until"), { status: 400 });
    }
    if (until.getTime() - since.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw Object.assign(new Error("xAPI exports are limited to a 366-day window"), { status: 400 });
    }

    const statements = await buildXapiExport({
      schoolId,
      since,
      until,
      source: query.source,
      limit: query.limit,
      pseudonymSecret: pseudonymSecret(),
    });

    const exportRecord = await prisma.exportRecord.create({
      data: {
        userId: user.id,
        exportType: "xapi_learning_events",
        scope: "school",
        scopeId: schoolId,
        filters: { since: query.since, until: query.until, source: query.source, piiIncluded: false },
        format: "json",
        pilotOnly: false,
      },
      select: { id: true },
    });
    await Promise.all([
      logAudit({
        userId: user.id,
        schoolId,
        action: "admin.interoperability.xapi.exported",
        resourceType: "export",
        resourceId: exportRecord.id,
        traceId,
        details: { statementCount: statements.length, source: query.source, since: query.since, until: query.until },
      }),
      logDataAccess({
        userId: user.id,
        schoolId,
        resourceType: "learning_event",
        resourceId: exportRecord.id,
        action: "export",
        scope: "school",
        traceId,
        metadata: { format: "xapi-1.0.3", statementCount: statements.length },
      }),
    ]);

    const filename = `liberialearn-xapi-${query.since}-${query.until}.json`;
    return new NextResponse(JSON.stringify(statements, null, 2), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/json; charset=utf-8",
        "X-Experience-API-Version": XAPI_VERSION,
        "X-Statement-Count": String(statements.length),
        "X-Request-Id": traceId,
      },
    });
  } catch (error) {
    return handleApiError(error, { requestId: traceId, route: "/api/admin/interoperability/xapi/export", method: "GET" });
  }
}
