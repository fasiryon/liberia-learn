// app/api/admin/governance/exports/jobs/route.ts — Sprint 7
// Platform-admin-only: create and list export job requests.
// GET  — list pending/approved/completed jobs
// POST — create a new export job request

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isGovExportsEnabled, isGovCircuitBreakerTripped } from "@/lib/serverFlags";
import {
  createExportJob,
  listExportJobs,
  type ExportType,
  type ExportScope,
  type ExportFormat,
} from "@/lib/exports/exportJobService";

export const dynamic = "force-dynamic";

const VALID_EXPORT_TYPES: ExportType[] = [
  "student_performance",
  "class_summary",
  "monthly_report",
  "intervention_effectiveness",
  "ai_usage",
];
const VALID_SCOPES: ExportScope[] = ["school", "national", "district"];
const VALID_FORMATS: ExportFormat[] = ["csv", "json"];

export async function GET(req: NextRequest) {
  try {
    if (isGovCircuitBreakerTripped()) {
      return NextResponse.json({ error: "governance_disabled" }, { status: 503 });
    }
    if (!isGovExportsEnabled()) {
      return NextResponse.json({ error: "governance_exports_disabled" }, { status: 403 });
    }

    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const approvalStatus = searchParams.get("approvalStatus") ?? undefined;
    const schoolId = searchParams.get("schoolId") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

    const result = await listExportJobs({ schoolId, approvalStatus, page });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (isGovCircuitBreakerTripped()) {
      return NextResponse.json({ error: "governance_disabled" }, { status: 503 });
    }
    if (!isGovExportsEnabled()) {
      return NextResponse.json({ error: "governance_exports_disabled" }, { status: 403 });
    }

    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { exportType, scope, scopeId, format, filters, schoolId } = body;

    if (!VALID_EXPORT_TYPES.includes(exportType)) {
      return NextResponse.json({ error: "Invalid exportType" }, { status: 400 });
    }
    if (!VALID_SCOPES.includes(scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }
    if (format && !VALID_FORMATS.includes(format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    const job = await createExportJob({
      requestedByUserId: user.id,
      schoolId: schoolId ?? user.schoolId ?? null,
      scope,
      scopeId: scopeId ?? null,
      exportType,
      format: format ?? "csv",
      filters,
      traceId,
    });

    return NextResponse.json(job, { status: 201 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
