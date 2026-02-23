# Feature Flags & Kill Switches

## Why
National systems require safe rollback and controlled rollout.

## Rules
- Any major feature must be flaggable.
- Phase 4 features must always be flaggable.
- Flags must support tenant-level configuration (future-ready).

## Emergency Switches
- disable messaging (per tenant)
- disable AI generation (fallback to manual tools)
- enable degraded mode (reduce heavy operations)

## Operational Discipline
Flags are not optional. They are safety infrastructure.