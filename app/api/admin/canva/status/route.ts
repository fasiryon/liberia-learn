import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { hasCanvaMcpAuthorizationToken } from "@/lib/canva/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("ADMIN");
    return NextResponse.json({ connected: hasCanvaMcpAuthorizationToken() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
