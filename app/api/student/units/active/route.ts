import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { loadActiveUnitsForStudent } from "@/lib/student/unitSequence.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    const units = await loadActiveUnitsForStudent(user.id);
    return NextResponse.json(units);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load active units" },
      { status: err?.status ?? 500 }
    );
  }
}
