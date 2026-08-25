# ADR 0016: Role variant schema decision packet

Status: PROPOSED, FOUNDER DECISION REQUIRED

Date: 2026-08-20

## Decision boundary

This ADR does not authorize a PostgreSQL enum migration. Production and
staging continue to support only:

- `TEACHER`
- `STUDENT`
- `GUARDIAN`
- `ADMIN`
- `DISTRICT_ADMIN`
- `MOE_OFFICIAL`

`MOE_SUPER_ADMIN` and `MOE_DISTRICT_ADMIN` remain application-declared but
unpersistable. The application persistence boundary rejects both values until
the founder approves a final hierarchy.

## Current identity concepts

| Concept | Current representation | Intended scope |
| --- | --- | --- |
| Platform administrator | `isPlatformAdmin = true` | LiberiaLearn platform operations and break-glass administration |
| School administrator | `ADMIN`, normally with `schoolId` | One school |
| National MOE official | `MOE_OFFICIAL` | National and district aggregate access plus governed MOE operations |
| District education administrator | `DISTRICT_ADMIN` | District and school aggregate views |
| Teacher | `TEACHER` | School and assigned-class scope |
| Proposed national MOE super-admin | `MOE_SUPER_ADMIN` | Not yet distinct from `MOE_OFFICIAL` in the permission matrix |
| Proposed MOE district administrator | `MOE_DISTRICT_ADMIN` | Substantially overlaps `DISTRICT_ADMIN` |

## Is MOE_SUPER_ADMIN distinct?

Not in the current permission model. `lib/permissions.ts` grants
`MOE_SUPER_ADMIN` effectively the same MOE permissions as `MOE_OFFICIAL`.
Several review and optimization helpers give it additional operational powers,
but those powers are not expressed as a coherent role boundary. Platform
administration is already represented independently by `isPlatformAdmin` and
must not be conflated with MOE authority.

Recommendation: do not add `MOE_SUPER_ADMIN` to the database. Use
`MOE_OFFICIAL` plus explicit permissions, qualification, step-up assurance, and
`isPlatformAdmin` only when platform authority is independently granted. If a
future national MOE delegation tier is needed, define its exclusive permissions
and qualification rules before adding an enum value.

## Is MOE_DISTRICT_ADMIN distinct?

Not clearly. `lib/moe/rbac.ts` aliases `MOE_DISTRICT_ADMIN` and
`DISTRICT_ADMIN`, while other helpers treat only `MOE_DISTRICT_ADMIN` as MOE or
give the two roles different access. No production user currently holds either
the proposed role or the deployed `DISTRICT_ADMIN` role.

Recommendation: retain `DISTRICT_ADMIN` as the single district or county
education-administrator role. Do not add `MOE_DISTRICT_ADMIN`. If Liberia needs
separate ministry and non-ministry district administrators, first define the
institutional distinction, tenant scope, appointment authority, and audit
requirements.

## Intended authority hierarchy

The recommended hierarchy is not a simple inheritance ladder. It is a set of
separate authority dimensions:

1. Platform authority: `isPlatformAdmin`, privileged identity, and recent
   step-up assurance.
2. National curriculum/government authority: `MOE_OFFICIAL` plus explicit MOE
   permissions and reviewer qualification.
3. District or county operational authority: `DISTRICT_ADMIN` with a required
   district scope.
4. School authority: `ADMIN` with a required school scope.
5. Classroom authority: `TEACHER` with school and assignment scope.

No role alone supplies curriculum-review qualification. P2-B qualification and
review-scope rules continue to apply.

## Current API references

`MOE_SUPER_ADMIN` is checked by:

- `app/api/admin/curriculum/[contentId]/governance/route.ts`
- `app/api/admin/curriculum/approve/route.ts`
- `app/api/admin/curriculum/reject/route.ts`
- `app/api/admin/ops/curriculum-review/route.ts`
- `app/api/admin/ops/optimization/route.ts`
- `app/api/admin/reviewer-credentials/route.ts`
- `app/api/admin/reviewers/route.ts`
- `app/api/admin/review-operations/reports/route.ts`
- `app/api/announcements/route.ts`
- `app/api/moe/curriculum/[contentId]/provenance/route.ts`
- `app/api/moe/live/route.ts`
- `app/api/moe/live-token/route.ts`
- `app/api/moe/waec-readiness/route.ts`

`MOE_DISTRICT_ADMIN` is checked by:

- `app/api/announcements/route.ts`
- `app/api/moe/curriculum/[contentId]/provenance/route.ts`

`DISTRICT_ADMIN` is checked by district dashboard routes, school aggregate
dashboard routes, optimization routes, announcements, and the MOE provenance
route. `MOE_OFFICIAL` remains the broadly used national role across curriculum,
optimization, intervention, RAG, search, and MOE routes.

## Current UI references

`MOE_SUPER_ADMIN` appears in:

- `app/admin/ops/effectiveness/page.tsx`
- `app/admin/ops/signals/page.tsx`
- `app/moe/live/page.tsx`
- `app/moe/memory/page.tsx`
- `app/moe/optimization/page.tsx`
- `app/review/operations/page.tsx`

There is no direct `MOE_DISTRICT_ADMIN` UI reference. `DISTRICT_ADMIN` appears
in compliance, operations, platform, MOE memory, and MOE optimization UI code.

## Disagreeing authorization helpers

- `lib/moe/rbac.ts` treats `MOE_DISTRICT_ADMIN` and `DISTRICT_ADMIN` as aliases.
- `lib/permissions.ts` gives them different permission sets.
- `lib/curriculum/review/access.ts` treats `MOE_DISTRICT_ADMIN` as MOE-wide for
  some reads while `lib/curriculum/review/eligibility.ts` explicitly denies it
  review eligibility.
- `lib/moe/routeGuard.ts` recognizes `MOE_OFFICIAL` but not the proposed MOE
  variants.
- `lib/moeAccess.ts` and several operations helpers sometimes treat
  `DISTRICT_ADMIN` as MOE-like aggregate authority.
- `lib/auth/privilegedIdentity.ts` classifies both proposed variants as
  privileged even though neither can exist in the database.
- `lib/permissions.ts` gives `MOE_SUPER_ADMIN` no clear exclusive permission
  relative to `MOE_OFFICIAL`.

## Persistence compatibility boundary

`lib/auth/databaseRoles.ts` is the current database-write guard. Invite
acceptance and Google SSO account creation validate the stored role against the
six deployed values. This prevents a string-backed invite or future caller
from attempting to persist an undeployed enum label.

If external identity providers emit legacy aliases before a final decision,
the compatibility layer should map them before persistence:

- `MOE_SUPER_ADMIN` to `MOE_OFFICIAL`, only when the identity is independently
  authorized for national MOE access.
- `MOE_DISTRICT_ADMIN` to `DISTRICT_ADMIN`, only when a valid district scope is
  present.

No alias mapping is implemented by this ADR because accepting external claims
requires a separate identity-provider decision.

## Additive migration if variants are approved

The existing proposal demonstrates the mechanical enum addition. Approval
would still require:

1. A final permission matrix with non-overlapping role semantics.
2. Tenant and district scope constraints.
3. Identity issuance and revocation rules.
4. Authentication, session, route, and UI tests.
5. One additive PostgreSQL enum migration with no existing-row rewrite.
6. Staging proof before production.

Until those conditions are approved, the proposed migration remains outside
the canonical migration root.
