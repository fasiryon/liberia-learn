# Tenancy Isolation

## Goal
Prevent cross-school data access and ensure every query is tenant-scoped.

## Rules
- Every data access path must include a tenant boundary.
- Tenant boundary must be enforced at the API/service layer at minimum.
- Any “global” operations must explicitly justify cross-tenant access.

## Controls
- Tenant ID propagation in session/auth context
- Access checks for every route and service
- Audit logs include tenant ID on every action
- Tests include negative cases: cross-tenant access must fail

## Definition of Done
- No route can return data from another tenant
- All queries can be traced to a tenant boundary
- Audit logs identify tenant for all actions