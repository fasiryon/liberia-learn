/**
 * Preview identity freeze (B5 follow-up, OneRoster finding; Revision 3 ordering). A deployed Preview/staging runtime
 * keeps exactly the operator-provisioned synthetic accounts: no route may create accounts, issue, reveal, send or
 * reset credentials (including the signed-in user's own PIN/password), issue or accept invites or transfer tokens,
 * change account lifecycle or change privilege.
 *
 * Ordering contract (Atlas, Revision 3): on a protected route the freeze runs AFTER the route's existing
 * authentication and authorization and BEFORE body parsing, provider calls or writes, so unauthenticated, wrong-role
 * and foreign-tenant callers keep their existing denials. Only the public entry points listed below refuse first.
 * A no-op for Production and local runs. The completeness scanner in
 * __tests__/helpers/identityFreezeScanner.ts enforces both placements per HTTP handler.
 */
import { NextResponse } from "next/server";
import { previewAutomationDisabled } from "@/lib/previewSideEffects";

export const PREVIEW_IDENTITY_FROZEN = "PREVIEW_IDENTITY_FROZEN";

/** Unauthenticated entry points whose freeze precedes everything (there is no authority to preserve). */
export const PREVIEW_PUBLIC_IDENTITY_ENTRY_POINTS: readonly string[] = [
  "app/api/register/student/route.ts",
  "app/api/register/guardian/route.ts",
  "app/api/guardian/register/route.ts",
  "app/api/enroll/route.ts",
  "app/api/auth/forgot-password/route.ts",
  "app/api/auth/reset-password/route.ts",
  "app/api/auth/reset-with-code/route.ts",
  "app/api/onboard/accept/route.ts",
];

export function previewIdentityFrozen(): NextResponse | null {
  if (!previewAutomationDisabled()) return null;
  return NextResponse.json(
    { ok: false, error: "Account changes are disabled in this Preview", code: PREVIEW_IDENTITY_FROZEN },
    { status: 403, headers: { "Cache-Control": "private, no-store" } }
  );
}
