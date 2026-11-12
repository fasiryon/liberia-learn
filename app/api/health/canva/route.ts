// route-policy: auth=public; scope=none; authority=none; rationale=public liveness reports handler availability only; provider, queue, schema and configuration diagnostics are not exposed or executed
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "alive" }, { headers: { "Cache-Control": "no-store" } });
}
