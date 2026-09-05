import type { SessionUser } from "@/lib/auth";
import type { OperationalScope } from "@/lib/ops/operationalSnapshot";

export function resolveOperationalScope(user: SessionUser, params: URLSearchParams): OperationalScope {
  const requestedScope = params.get("scope")?.trim() || "school";
  const requestedSchoolId = params.get("schoolId")?.trim() || null;
  if (!["school", "national"].includes(requestedScope)) throw Object.assign(new Error("Invalid operational scope"), { status: 400 });
  if (requestedSchoolId && (requestedSchoolId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(requestedSchoolId))) throw Object.assign(new Error("Invalid schoolId"), { status: 400 });
  if (requestedScope === "national" && requestedSchoolId) throw Object.assign(new Error("schoolId cannot be combined with national scope"), { status: 400 });

  const privilegedAggregate = Boolean(user.isPlatformAdmin) || user.role === "MOE_SUPER_ADMIN";
  if (requestedScope === "national") {
    if (!privilegedAggregate) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return { kind: "NATIONAL" };
  }
  if (!privilegedAggregate && user.role !== "ADMIN") throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (requestedSchoolId && !privilegedAggregate && requestedSchoolId !== user.schoolId) throw Object.assign(new Error("Forbidden"), { status: 403 });
  const schoolId = requestedSchoolId ?? user.schoolId ?? null;
  if (!schoolId) {
    if (privilegedAggregate) return { kind: "NATIONAL" };
    throw Object.assign(new Error("School scope required"), { status: 400 });
  }
  return { kind: "SCHOOL", schoolId };
}


