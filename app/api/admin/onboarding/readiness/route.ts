import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getOnboardingReadinessReport } from "@/lib/readiness/readinessService";
import {
  isPilotReadinessDashboardEnabled,
  isPilotReadinessEnabled,
} from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isPilotReadinessDashboardEnabled() || !isPilotReadinessEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "No school" }, { status: 400 });
    }

    const report = await getOnboardingReadinessReport(user.schoolId);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load onboarding readiness" },
      { status: error?.status ?? 500 }
    );
  }
}
