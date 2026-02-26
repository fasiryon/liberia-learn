# ADR 0014: Interventions and District Layer

Date: 2026-02-26
Status: Accepted

## Context
LiberiaLearn requires aggregate-only intervention recommendations and district-level intelligence views. The system must remain governance-first: no PII, no cross-district access, and no auto-application of AI guidance.

## Decisions
1. **Advisory-only recommendations**
   AI interventions never auto-apply changes. They are guidance for administrators, preserving human oversight.

2. **Deterministic-first, AI-augmented**
   Recommendations are computed from deterministic rules first. Optional AI enhancement can augment actions but never overrides deterministic safety rules.

3. **District as distinct scope**
   District intelligence is treated as its own scope, not a filtered national view. This simplifies access control and reduces cross-scope leakage risk.

4. **No cross-district access**
   District admins are hard-scoped to their district. Requests for other districts are denied.

5. **Nullable School.districtId for backward compatibility**
   School records can exist without a district assignment. This avoids migration breaks and supports phased rollout.

## Consequences
- Additional models (`District`, `InterventionLog`) and routes are introduced.
- Feature flags default OFF to limit exposure until governance reviews are complete.
- Tests explicitly cover cross-district isolation.
