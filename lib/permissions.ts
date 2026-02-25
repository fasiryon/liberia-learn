/**
 * lib/permissions.ts — Permissions Matrix (Block 6)
 *
 * Single source of truth for role-based access control.
 * Mirrors docs/governance/PERMISSIONS_MATRIX.md.
 *
 * Design principles:
 *  - Least privilege: default deny; explicit allow lists per role
 *  - Platform admins (isPlatformAdmin=true) bypass all role checks
 *  - All privilege escalations throw { status: 403 } for API consistency
 *
 * See docs/adr/0008-moe-governance-controls.md for decision rationale.
 */

export const PERMISSIONS = {
  // ── Compliance & Audit ────────────────────────────────────────────────────
  /** View the paginated audit log for the admin's school (or all schools for platform admin). */
  COMPLIANCE_AUDIT_READ: "compliance:audit_log:read",
  /** Download the audit log as CSV. */
  COMPLIANCE_AUDIT_EXPORT: "compliance:audit_log:export",

  // ── Data Governance Exports ───────────────────────────────────────────────
  /** Export aggregated school-level data (student performance, class summary, monthly report). */
  GOVERNANCE_EXPORT_SCHOOL: "governance:export:school",
  /** Export national-aggregate data across all schools. Platform admin only. */
  GOVERNANCE_EXPORT_NATIONAL: "governance:export:national",
  /** Include PII fields in exports. Platform admin only + ENABLE_GOV_STUDENT_PII_EXPORT flag. */
  GOVERNANCE_EXPORT_PII: "governance:export:pii",

  // ── School Management ──────────────────────────────────────────────────────
  SCHOOL_SETTINGS_WRITE: "school:settings:write",
  SCHOOL_BRANDING_WRITE: "school:branding:write",

  // ── Training ──────────────────────────────────────────────────────────────
  TRAINING_ADOPTION_READ: "training:adoption:read",

  // ── Ops Intelligence (Block 5 compat) ─────────────────────────────────────
  OPS_FINDINGS_READ: "ops:findings:read",
  OPS_FINDINGS_MANAGE: "ops:findings:manage",
  OPS_AI_EXPLAIN: "ops:ai:explain",

  // ── Impact Analytics (Block 12A) ──────────────────────────────────────────
  /** View school-level impact dashboard (proficiency/mastery/growth metrics). */
  DASHBOARD_SCHOOL_IMPACT: "dashboard:school:impact",
  /** View school-level intervention alerts (class aggregates only, no student IDs). */
  DASHBOARD_SCHOOL_INTERVENTIONS: "dashboard:school:interventions",
  // National impact: platform admin only — enforced via requirePlatformAdmin(), no separate permission.
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Per-role explicit allow lists.
 * STUDENT and GUARDIAN have no governance permissions (empty sets = deny all).
 * Platform admins bypass this map entirely (see hasPermission).
 */
export const ROLE_PERMISSIONS: Record<string, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    PERMISSIONS.COMPLIANCE_AUDIT_READ,
    PERMISSIONS.COMPLIANCE_AUDIT_EXPORT,
    PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL,
    PERMISSIONS.SCHOOL_SETTINGS_WRITE,
    PERMISSIONS.SCHOOL_BRANDING_WRITE,
    PERMISSIONS.TRAINING_ADOPTION_READ,
    PERMISSIONS.OPS_FINDINGS_READ,
    PERMISSIONS.OPS_FINDINGS_MANAGE,
    PERMISSIONS.OPS_AI_EXPLAIN,
    // Block 12
    PERMISSIONS.DASHBOARD_SCHOOL_IMPACT,
    PERMISSIONS.DASHBOARD_SCHOOL_INTERVENTIONS,
  ]),
  TEACHER: new Set<Permission>([]),
  STUDENT: new Set<Permission>([]),
  GUARDIAN: new Set<Permission>([]),
} as const;

/**
 * Returns true if the user holds the given permission.
 * Platform admins always return true.
 */
export function hasPermission(
  user: { role: string; isPlatformAdmin?: boolean },
  permission: Permission
): boolean {
  if (user.isPlatformAdmin) return true;
  const perms = ROLE_PERMISSIONS[user.role];
  return perms?.has(permission) ?? false;
}

/**
 * Throws { status: 403 } if the user does not hold the permission.
 * Use at the top of API route handlers after requireRole().
 */
export function assertPermission(
  user: { role: string; isPlatformAdmin?: boolean },
  permission: Permission
): void {
  if (!hasPermission(user, permission)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}
