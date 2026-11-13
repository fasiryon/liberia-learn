// route-policy: auth=session; scope=platform; authority=platform-admin; rationale=only a platform ADMIN may read global Canva integration status
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { hasCanvaMcpAuthorizationToken } from "@/lib/canva/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    if (user.isPlatformAdmin !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ connected: hasCanvaMcpAuthorizationToken() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
