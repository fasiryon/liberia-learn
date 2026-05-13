import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import type { ForecastScope } from "@/lib/autonomous/predictions/types";

export function assertPredictiveAccess(user: SessionUser) {
  const role = String(user.role ?? "");
  const allowed =
    user.isPlatformAdmin ||
    role === "ADMIN" ||
    role === "MOE_OFFICIAL" ||
    role === "DISTRICT_ADMIN" ||
    role === "MOE_SUPER_ADMIN";
  if (!allowed) throw Object.assign(new Error("Forbidden"), { status: 403 });
}

export function forecastScopeForUser(user: SessionUser): { scope: ForecastScope; label: string } {
  const role = String(user.role ?? "");
  if (user.isPlatformAdmin) return { scope: { aggregateSafe: true }, label: "Platform aggregate-safe view" };
  if (role === "MOE_OFFICIAL" || role === "DISTRICT_ADMIN" || role === "MOE_SUPER_ADMIN") {
    return { scope: { aggregateSafe: true }, label: "MOE aggregate-safe view" };
  }
  return { scope: { schoolId: user.schoolId ?? "__none__", aggregateSafe: false }, label: "School tenant view" };
}

export async function auditPredictiveRead(input: { user: SessionUser; route: string; scope: ForecastScope }) {
  await logAudit({
    userId: input.user.id,
    schoolId: input.scope.aggregateSafe ? null : input.scope.schoolId ?? null,
    action: "predictive.forecast.read",
    resourceType: "AutonomousPrediction",
    resourceId: input.route,
    details: { route: input.route, aggregateSafe: input.scope.aggregateSafe === true },
  }).catch(() => null);
}
