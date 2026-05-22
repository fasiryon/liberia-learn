// app/api/admin/governance/exports/jobs/[jobId]/download/route.ts — Sprint 7
// Authenticated download: returns the presigned S3 URL for a completed export job.
// Audited on every access. URL expires 24h from job completion.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isGovCircuitBreakerTripped } from "@/lib/serverFlags";
import { getExportDownload } from "@/lib/exports/exportJobService";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const traceId = randomUUID();
  try {
    if (isGovCircuitBreakerTripped()) {
      return NextResponse.json({ error: "governance_disabled" }, { status: 503 });
    }

    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin only" }, { status: 403 });
    }
    assertPermission(user, PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL);

    const downloadUrl = await getExportDownload({
      jobId: params.jobId,
      userId: user.id,
      traceId,
    });

    return NextResponse.json({ downloadUrl, expiresIn: "24h" });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
