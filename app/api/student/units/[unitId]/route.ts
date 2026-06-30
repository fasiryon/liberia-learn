import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { loadUnitSequenceForStudent } from "@/lib/student/unitSequence.server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { unitId: string } }
) {
  try {
    const user = await requireRole("STUDENT");
    const sequence = await loadUnitSequenceForStudent({
      unitId: params.unitId,
      studentUserId: user.id,
    });

    if (!sequence) {
      return NextResponse.json({ error: "unit_not_found" }, { status: 404 });
    }
    return NextResponse.json(sequence);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load unit" },
      { status: err?.status ?? 500 }
    );
  }
}
