// app/api/admin/governance/exports/jobs/[jobId]/approve/route.ts — Sprint 7
// Platform-admin-only: approve or reject a pending export job.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isGovCircuitBreakerTripped } from "@/lib/serverFlags";
import { approveExportJob, rejectExportJob } from "@/lib/exports/exportJobService";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
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

    const body = await req.json().catch(() => ({}));
    const decision: "approve" | "reject" = body.decision === "reject" ? "reject" : "approve";
    const reason: string | undefined = body.reason;

    const { jobId } = params;

    if (decision === "approve") {
      const job = await approveExportJob({ jobId, approvedByUserId: user.id, traceId });
      return NextResponse.json(job);
    } else {
      const job = await rejectExportJob({ jobId, rejectedByUserId: user.id, reason, traceId });
      return NextResponse.json(job);
    }
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
