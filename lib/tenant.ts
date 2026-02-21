// lib/tenant.ts
import { requireUser } from "@/lib/auth";

export async function requireTenant() {
  const user = await requireUser();
  const schoolId = (user.schoolId ?? null) as string | null;
  if (!schoolId) throw Object.assign(new Error("Missing schoolId"), { status: 400 });
  return { user, schoolId };
}

/** Like requireTenant but platform admins can pass without schoolId. */
export async function requireTenantOrPlatformAdmin() {
  const user = await requireUser();
  const schoolId = (user.schoolId ?? null) as string | null;
  if (user.isPlatformAdmin) {
    return { user, schoolId }; // schoolId may be null for platform admins
  }
  if (!schoolId) throw Object.assign(new Error("Missing schoolId"), { status: 400 });
  return { user, schoolId };
}

