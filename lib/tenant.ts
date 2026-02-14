// lib/tenant.ts
import { requireUser } from "@/lib/auth";

export async function requireTenant() {
  const user = await requireUser();
  const schoolId = (user.schoolId ?? null) as string | null;
  if (!schoolId) throw Object.assign(new Error("Missing schoolId"), { status: 400 });
  return { user, schoolId };
}
