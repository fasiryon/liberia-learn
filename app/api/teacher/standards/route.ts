import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { buildStandardsBrowser } from "@/lib/moe/standardsBrowser";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const result = await buildStandardsBrowser(user.schoolId ?? null);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load standards" }, { status: err?.status ?? 500 });
  }
}
