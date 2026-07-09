import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";

/**
 * Shared guard for the agent admin surfaces: authenticated ADMIN / platform
 * admin holding AGENT_PLATFORM_VIEW. Throws {status:403} otherwise.
 */
export async function requireAgentAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  assertPermission(user, PERMISSIONS.AGENT_PLATFORM_VIEW);
  return user;
}

/** Map a thrown error to an HTTP status for the agent admin routes. */
export function agentAdminStatus(err: unknown): number {
  return (err as { status?: number })?.status ?? 500;
}
