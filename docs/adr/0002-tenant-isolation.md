# ADR 0002 — Multi-Tenant School Isolation Model

## Status
Accepted

## Context
LiberiaLearn serves multiple schools and must prevent cross-school data access. Any leakage would be unacceptable at national scale.

## Decision
We enforce tenant isolation as a first-class invariant:
- every request carries a tenant context
- every query is tenant-scoped
- every authorization decision is tenant-aware
- audit logs record tenant for all actions
- negative tests enforce cross-tenant denial

## Consequences
- Tenant scoping becomes a mandatory dev habit
- Refactors must preserve tenant checks
- Centralized helpers for tenant context are preferred

## Alternatives Considered
- Shared global tables with implicit filtering (rejected: high leakage risk)
- Separate database per tenant (deferred: operational cost; revisit later)