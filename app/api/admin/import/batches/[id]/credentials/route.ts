// route-policy: auth=session; scope=record; authority=school-admin; rationale=reveals generated credentials of one import batch; refused on any deployed Preview/staging after authority and before body or data work (PREVIEW_IDENTITY_FROZEN)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { consumeImportBatchCredentialCsv } from "@/lib/school-operations";
import { previewIdentityFrozen } from "@/lib/preview/identityFreeze";
import { previewSafeErrorResponse } from "@/lib/preview/safeError";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const frozen = previewIdentityFrozen();
    if (frozen) return frozen;
    const csv = await consumeImportBatchCredentialCsv(user.schoolId, params.id);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="import-credentials-${params.id}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: any) {
    const safe = previewSafeErrorResponse(err);
    if (safe) return safe;
    return NextResponse.json({ error: err?.message ?? "Download failed" }, { status: err?.status ?? 500 });
  }
}
