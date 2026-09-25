// route-policy: auth=session; scope=tenant; authority=support-sync-diagnostics-read; rationale=a school admin reads payload-free sync diagnostics only for a learner in their own school and every read is durably audited
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { SyncDiagnosticsError, readLearnerSyncDiagnostics } from "@/lib/support/learnerSyncDiagnostics";

export const dynamic = "force-dynamic";

/** Read-only. This route exposes no mutation of queue, evidence, mastery, or release. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ learnerId: string }> },
) {
  try {
    const user = await requireUser();
    const { learnerId } = await params;
    const diagnostics = await readLearnerSyncDiagnostics(user, learnerId);
    return NextResponse.json({ diagnostics }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    if (err instanceof SyncDiagnosticsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const status = typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json({ error: status === 500 ? "Internal error" : err.message }, { status });
  }
}
