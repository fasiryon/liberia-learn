import type { SessionUser } from "@/lib/auth";

export type ReportScope = "school" | "county" | "district" | "national";

export type ResolvedScope = {
  scope: ReportScope;
  scopeId: string | null;
};

export function normalizeScope(raw: string | null | undefined): ReportScope {
  const value = (raw ?? "school").toLowerCase();
  if (value === "school" || value === "county" || value === "district" || value === "national") {
    return value;
  }
  throw Object.assign(new Error("Invalid scope"), { status: 400 });
}

export function resolveScopeParams({
  scopeParam,
  scopeIdParam,
  user,
}: {
  scopeParam?: string | null;
  scopeIdParam?: string | null;
  user: SessionUser;
}): ResolvedScope {
  const scope = normalizeScope(scopeParam);
  const isPlatform = user.isPlatformAdmin ?? false;

  if (scope === "school") {
    const scopeId = scopeIdParam ?? user.schoolId ?? null;
    if (!scopeId) throw Object.assign(new Error("Missing scopeId"), { status: 400 });
    if (!isPlatform && scopeId !== user.schoolId) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    return { scope, scopeId };
  }

  if (scope === "county" || scope === "district") {
    if (!isPlatform) throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (!scopeIdParam) throw Object.assign(new Error("Missing scopeId"), { status: 400 });
    return { scope, scopeId: scopeIdParam };
  }

  if (!isPlatform) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return { scope, scopeId: null };
}

export function parsePilotOnly(param: string | null | undefined, user: SessionUser): boolean {
  if (param == null || param === "") return true;
  if (param !== "true" && param !== "false") {
    throw Object.assign(new Error("Invalid pilotOnly"), { status: 400 });
  }
  const value = param === "true";
  if (!value && !(user.isPlatformAdmin ?? false)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return value;
}

