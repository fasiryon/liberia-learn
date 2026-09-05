import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOperationalSnapshot } from "@/lib/ops/operationalSnapshot";
import { operationalSourceReaders } from "@/lib/ops/operationalSources";
import { resolveOperationalScope } from "@/lib/ops/access";

// route-policy: auth=session; scope=national; authority=elevated; rationale=read-only operational snapshot is platform-admin only

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const scope = resolveOperationalScope(user, request.nextUrl.searchParams);
    const snapshot = await getOperationalSnapshot({ scope, readers: operationalSourceReaders });
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, no-store", "X-Ops-Snapshot-Version": String(snapshot.version) } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Operational snapshot unavailable" }, { status: error?.status ?? 500 });
  }
}
