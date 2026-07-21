import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { consumeImportBatchCredentialCsv } from "@/lib/school-operations";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

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
    return NextResponse.json({ error: err?.message ?? "Download failed" }, { status: err?.status ?? 500 });
  }
}
