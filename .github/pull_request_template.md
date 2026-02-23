# LiberiaLearn PR — National Standards Checklist

## Summary
- What does this PR change?
- Which user roles are impacted (Admin/Teacher/Student/Guardian/Champion)?

## Phase Alignment
- [ ] Phase 1 (Core Stabilization)
- [ ] Phase 2 (AI Curriculum Engine)
- [ ] Phase 2.5 (Digital Literacy Infrastructure)
- [ ] Phase 3 (Governance & Reliability)
- [ ] Phase 4 (National Intelligence)
- [ ] Cross-Phase Track (Telemetry / Self-Healing Ops / Docs)

## Risk Level
- [ ] Low (UI copy, non-critical refactor)
- [ ] Medium (workflow changes, minor schema change)
- [ ] High (auth/tenancy/offline/sms/permissions)
Explain risk:
- Risk:
- Blast radius:
- Mitigation:

## Telemetry & Observability (Required)
- [ ] Added/updated structured logs (tenant + role + route)
- [ ] Added/updated metrics counters (errors/latency/feature usage)
- [ ] Added/updated audit logging (if user-data action)
Describe telemetry added/updated:

## Feature Flags / Kill Switch (If applicable)
- [ ] Not needed (explain why)
- [ ] Added feature flag
- [ ] Added/updated kill switch / degraded mode option
Flag name(s) and behavior:

## Offline-First Impact
- [ ] No offline impact
- [ ] Offline-safe (works without connectivity)
- [ ] Sync payload/protocol changed (must update version governance)
Notes:

## Security & Tenancy Isolation (Mandatory Review if relevant)
- [ ] No auth/tenancy changes
- [ ] Auth/session changes reviewed carefully
- [ ] Tenant boundary enforced in new/changed queries
- [ ] Permission matrix updated (if role capability changed)
Notes:

## Messaging Safety (If SMS/WhatsApp touched)
- [ ] Opt-in/out preserved
- [ ] Quiet hours preserved
- [ ] Throttles preserved/updated
- [ ] Delivery failures handled safely
Notes:

## AI Transparency (If AI touched)
- [ ] Explanation / “why” included
- [ ] Teacher override path exists
- [ ] AI action logged (accept/reject)
- [ ] Prompt/template/schema versions updated
Notes:

## Data Governance (If data touched)
- [ ] Export compatibility maintained
- [ ] Deletion/offboarding policy unaffected or updated
- [ ] No destructive migration without plan
Notes:

## Tests (Required)
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Smoke tests run
- [ ] Build/typecheck passes
Evidence (paste logs or describe):

## Docs (Required)
- [ ] No doc updates needed (explain)
- [ ] Updated docs in `docs/` (list files)
Docs updated:

## Rollback Plan (Required)
- [ ] Feature flag rollback
- [ ] Revert commit
- [ ] Hotfix patch release
Rollback steps:

## Screenshots / Evidence (UI changes)
Attach screenshots or short video if UI changed.