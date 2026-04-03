import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOpsDashboardData } from "@/lib/ops/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dashboard = await getOpsDashboardData();
    return NextResponse.json(dashboard);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load ops dashboard" },
      { status: err?.status ?? 500 }
    );
  }
}
