import { requireRole } from "@/lib/auth";

/** Global content operations retain ADMIN role and require the canonical platform grant. */
export async function requirePlatformContentAdmin() {
  const user = await requireRole("ADMIN");
  if (user.isPlatformAdmin !== true) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return user;
}
