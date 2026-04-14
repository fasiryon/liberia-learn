/**
 * lib/permissions.ts  Permissions Matrix (Block 6)
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
  //  Compliance & Audit 
  /** View the paginated audit log for the admin's school (or all schools for platform admin). */
  COMPLIANCE_AUDIT_READ: "compliance:audit_log:read",
  /** Download the audit log as CSV. */
  COMPLIANCE_AUDIT_EXPORT: "compliance:audit_log:export",

  //  Data Governance Exports 
  /** Export aggregated school-level data (student performance, class summary, monthly report). */
  GOVERNANCE_EXPORT_SCHOOL: "governance:export:school",
  /** Export national-aggregate data across all schools. Platform admin only. */
  GOVERNANCE_EXPORT_NATIONAL: "governance:export:national",
  /** Include PII fields in exports. Platform admin only + ENABLE_GOV_STUDENT_PII_EXPORT flag. */
  GOVERNANCE_EXPORT_PII: "governance:export:pii",

  //  School Management 
  SCHOOL_SETTINGS_WRITE: "school:settings:write",
  SCHOOL_BRANDING_WRITE: "school:branding:write",

  //  Training 
  TRAINING_ADOPTION_READ: "training:adoption:read",

  //  Ops Intelligence (Block 5 compat) 
  OPS_FINDINGS_READ: "ops:findings:read",
  OPS_FINDINGS_MANAGE: "ops:findings:manage",
  OPS_AI_EXPLAIN: "ops:ai:explain",

  //  Impact Analytics (Block 12A) 
  /** View school-level impact dashboard (proficiency/mastery/growth metrics). */
  DASHBOARD_SCHOOL_IMPACT: "dashboard:school:impact",
  /** View school-level intervention alerts (class aggregates only, no student IDs). */
  DASHBOARD_SCHOOL_INTERVENTIONS: "dashboard:school:interventions",
  /** View school-level dashboard (aggregate only). */
  VIEW_SCHOOL_DASHBOARD: "view:school:dashboard",
  /** View district-level dashboard (aggregate only). */
  VIEW_DISTRICT_DASHBOARD: "view:district:dashboard",
  VIEW_NATIONAL_DASHBOARD: "view:national:dashboard",
  // National impact: platform admin only  enforced via requirePlatformAdmin(), no separate permission.
  /** MOE district-level access (data scoped to a district). */
  MOE_ACCESS_DISTRICT: "moe:access:district",
  /** MOE national-level access (all-districts aggregate). */
  MOE_ACCESS_NATIONAL: "moe:access:national",
  /** Override curriculum content (MOE). */
  CURRICULUM_OVERRIDE: "curriculum:content:override",
  /** Create and manage curriculum versions. */
  CURRICULUM_VERSION_MANAGE: "curriculum:version:manage",
  /** Create and manage MOE delivery policies. */
  POLICY_CONTROL: "policy:moe:control",
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
    PERMISSIONS.VIEW_SCHOOL_DASHBOARD,
  ]),
  DISTRICT_ADMIN: new Set<Permission>([
    PERMISSIONS.DASHBOARD_SCHOOL_IMPACT,
    PERMISSIONS.DASHBOARD_SCHOOL_INTERVENTIONS,
    PERMISSIONS.VIEW_SCHOOL_DASHBOARD,
    PERMISSIONS.VIEW_DISTRICT_DASHBOARD,
  ]),
  // Sprint 6: MOE roles — national and district scopes
  MOE_OFFICIAL: new Set<Permission>([
    PERMISSIONS.MOE_ACCESS_NATIONAL,
    PERMISSIONS.MOE_ACCESS_DISTRICT,
    PERMISSIONS.VIEW_DISTRICT_DASHBOARD,
    PERMISSIONS.VIEW_SCHOOL_DASHBOARD,
    PERMISSIONS.DASHBOARD_SCHOOL_IMPACT,
    PERMISSIONS.DASHBOARD_SCHOOL_INTERVENTIONS,
    PERMISSIONS.CURRICULUM_OVERRIDE,
    PERMISSIONS.CURRICULUM_VERSION_MANAGE,
    PERMISSIONS.POLICY_CONTROL,
  ]),
  MOE_SUPER_ADMIN: new Set<Permission>([
    PERMISSIONS.MOE_ACCESS_NATIONAL,
    PERMISSIONS.MOE_ACCESS_DISTRICT,
    PERMISSIONS.VIEW_DISTRICT_DASHBOARD,
    PERMISSIONS.VIEW_SCHOOL_DASHBOARD,
    PERMISSIONS.DASHBOARD_SCHOOL_IMPACT,
    PERMISSIONS.DASHBOARD_SCHOOL_INTERVENTIONS,
    PERMISSIONS.CURRICULUM_OVERRIDE,
    PERMISSIONS.CURRICULUM_VERSION_MANAGE,
    PERMISSIONS.POLICY_CONTROL,
  ]),
  MOE_DISTRICT_ADMIN: new Set<Permission>([
    PERMISSIONS.MOE_ACCESS_DISTRICT,
    PERMISSIONS.VIEW_DISTRICT_DASHBOARD,
    PERMISSIONS.VIEW_SCHOOL_DASHBOARD,
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
  if (permission === PERMISSIONS.VIEW_NATIONAL_DASHBOARD) {
    return false;
  }
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


