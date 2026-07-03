import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getNationalWaecReadiness } from "@/lib/waec/aggregate";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["MOE_OFFICIAL", "MOE_SUPER_ADMIN", "ADMIN"]);

export async function GET() {
  try {
    const user = await requireUser();
    if (!ALLOWED.has(user.role) && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const data = await getNationalWaecReadiness();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: e?.status ?? 500 });
  }
}
