import type { SessionUser } from "@/lib/auth"

export class SchoolAccessError extends Error {
  constructor(message = "Access denied: school mismatch") {
    super(message)
    this.name = "SchoolAccessError"
  }
}

/**
 * Asserts that the authenticated user has access to the given schoolId.
 *
 * Rules:
 *  - STUDENT / TEACHER / GUARDIAN / ADMIN: must belong to that school
 *  - MOE_OFFICIAL: cross-school access (national view)
 *  - isPlatformAdmin: cross-school access (ops)
 *
 * Throws SchoolAccessError if access is denied.
 */
export async function assertSchoolAccess(
  user: Pick<SessionUser, "id" | "role" | "schoolId" | "isPlatformAdmin">,
  targetSchoolId: string
): Promise<void> {
  if (user.isPlatformAdmin) return
  if (user.role === "MOE_OFFICIAL") return

  if (user.schoolId !== targetSchoolId) {
    throw new SchoolAccessError(
      `User ${user.id} (school: ${user.schoolId ?? "none"}) attempted to access school ${targetSchoolId}`
    )
  }
}

/**
 * Returns a 403 Response if the user does not have access to targetSchoolId,
 * or null if access is granted. Use in API route handlers for early return.
 */
export async function checkSchoolAccess(
  user: Parameters<typeof assertSchoolAccess>[0],
  targetSchoolId: string
): Promise<Response | null> {
  try {
    await assertSchoolAccess(user, targetSchoolId)
    return null
  } catch (e) {
    if (e instanceof SchoolAccessError) {
      console.warn("[TENANT]", e.message)
      return Response.json({ error: "Access denied" }, { status: 403 })
    }
    throw e
  }
}
