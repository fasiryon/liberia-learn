import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getImportBatchForSchool } from "@/lib/school-operations";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const batch = await getImportBatchForSchool(user.schoolId, params.id);
    return NextResponse.json({ ok: true, batch });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}
