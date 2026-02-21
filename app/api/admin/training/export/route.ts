import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { buildTrainingExport } from "@/lib/exports/trainingExport";
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

    const formatParam = (searchParams.get("format") ?? "csv").toLowerCase();
    const format = formatParam === "json" ? "json" : "csv";

    const result = await buildTrainingExport({
      userId: user.id,
      scope,
      scopeId,
      pilotOnly,
      format,
    });

    const filename = `training-summary-${new Date().toISOString().slice(0, 10)}.${format}`;
    return new NextResponse(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}


