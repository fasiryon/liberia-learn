import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { parseOneRosterZip, type OneRosterValidationIssue } from "@/lib/interoperability/oneroster";
import { createOneRosterImportBatch } from "@/lib/interoperability/onerosterService";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

const MAX_ZIP_BYTES = 5 * 1024 * 1024;

function issueText(issue: OneRosterValidationIssue) {
  const location = [issue.file, issue.row ? `row ${issue.row}` : null, issue.field]
    .filter(Boolean)
    .join(" / ");
  return location ? `${location}: ${issue.message}` : issue.message;
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    const form = await req.formData();
    const mode = String(form.get("mode") ?? "preview");
    if (mode !== "preview" && mode !== "commit") {
      throw Object.assign(new Error("mode must be preview or commit"), { status: 400 });
    }
    const requestedSchoolId = String(form.get("schoolId") ?? "").trim() || undefined;
    const schoolId = resolveAdminSchoolScope(user, requestedSchoolId);
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw Object.assign(new Error("A OneRoster ZIP file is required"), { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      throw Object.assign(new Error("OneRoster packages must use the .zip file extension"), { status: 400 });
    }
    if (file.size < 1 || file.size > MAX_ZIP_BYTES) {
      throw Object.assign(new Error("OneRoster ZIP must be between 1 byte and 5 MB"), { status: 400 });
    }

    const parsed = await parseOneRosterZip(new Uint8Array(await file.arrayBuffer()));
    const preview = {
      valid: parsed.valid,
      counts: {
        users: parsed.counts.users,
        classes: parsed.counts.classes,
        enrollments: parsed.counts.enrollments,
        roles: parsed.counts.roles,
        courses: parsed.counts.courses,
        academicSessions: parsed.counts.academicSessions,
      },
      errors: parsed.errors.map(issueText),
      warnings: parsed.warnings.map(issueText),
    };
    if (mode === "preview") {
      return NextResponse.json({ preview }, { headers: { "Cache-Control": "no-store", "X-Request-Id": traceId } });
    }
    if (!parsed.valid) {
      return NextResponse.json(
        { error: "OneRoster package validation failed", preview },
        { status: 422, headers: { "Cache-Control": "no-store", "X-Request-Id": traceId } }
      );
    }

    const result = await createOneRosterImportBatch({
      actorUserId: user.id,
      schoolId,
      fileName: file.name,
      parsed,
    });
    return NextResponse.json(result, {
      status: result.status === "QUEUED" ? 202 : 200,
      headers: { "Cache-Control": "no-store", "X-Request-Id": traceId },
    });
  } catch (error) {
    return handleApiError(error, { requestId: traceId, route: "/api/admin/interoperability/oneroster/import", method: "POST" });
  }
}
