import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getActiveTeacherAlerts,
  getAllTeacherAlerts,
  markAlertReviewed,
  dismissTeacherAlert,
} from "@/lib/intelligence/teacherAlerts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) return NextResponse.json({ alerts: [] });

    const url = new URL(request.url);
    const filter = url.searchParams.get("filter");

    if (filter && filter !== "active") {
      const validFilters = ["all", "reviewed", "dismissed"] as const;
      const f = validFilters.includes(filter as (typeof validFilters)[number])
        ? (filter as "all" | "reviewed" | "dismissed")
        : "all";
      const alerts = await getAllTeacherAlerts(user.id, user.schoolId, f);
      return NextResponse.json({ alerts });
    }

    const alerts = await getActiveTeacherAlerts(user.id, user.schoolId);
    return NextResponse.json({ alerts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const body = await request.json();
    const { alertId, action, reason } = body as {
      alertId: string;
      action: "reviewed" | "dismissed";
      reason?: string;
    };

    if (!alertId || !action) {
      return NextResponse.json({ error: "alertId and action required" }, { status: 400 });
    }

    if (action === "reviewed") {
      await markAlertReviewed(alertId, user.id);
    } else if (action === "dismissed") {
      await dismissTeacherAlert(alertId, user.id, reason);
    } else {
      return NextResponse.json({ error: "action must be 'reviewed' or 'dismissed'" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
