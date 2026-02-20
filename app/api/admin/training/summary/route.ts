import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getTrainingSummary } from "@/lib/reporting/training";
import { parsePilotOnly, resolveScopeParams } from "@/lib/reporting/scope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);

    const { scope, scopeId } = resolveScopeParams({
      scopeParam: searchParams.get("scope"),
      scopeIdParam: searchParams.get("scopeId"),
      user,
    });
    const pilotOnly = parsePilotOnly(searchParams.get("pilotOnly"), user);

    const summary = await getTrainingSummary({ scope, scopeId, pilotOnly });
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

