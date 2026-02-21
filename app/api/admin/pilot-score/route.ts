import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { computePilotScore } from "@/lib/pilot-score";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const result = await computePilotScore(user.schoolId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

