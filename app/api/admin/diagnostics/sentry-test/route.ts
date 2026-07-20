/**
 * GET /api/admin/diagnostics/sentry-test
 *
 * Platform-admin-only diagnostic that intentionally throws a harmless error
 * so ops can confirm Sentry is actually capturing real events in production,
 * not just configured-looking (SENTRY_DSN/SENTRY_AUTH_TOKEN/SENTRY_ORG/
 * SENTRY_PROJECT present in env). Touches no production data.
 *
 * Auth: Platform admin ONLY (requirePlatformAdmin)
 */
import { requirePlatformAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePlatformAdmin();
    throw new Error("Sprint 6.9 Sentry verification probe — intentional, harmless, safe to ignore");
  } catch (err) {
    return handleApiError(err, { route: "/api/admin/diagnostics/sentry-test", method: "GET" });
  }
}
