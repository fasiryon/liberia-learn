# ADR 0014: Interventions and District Layer

Date: 2026-02-26
Status: Accepted
Block: 13-14
Authors: Platform Engineering

## Context
LiberiaLearn requires aggregate-only intervention recommendations and district-level intelligence views. The system must remain governance-first: no PII, no cross-district access, and no auto-application of AI guidance.

## Rationale
- District dashboards introduce a new scope; explicit isolation prevents cross-district leakage.
- Intervention recommendations must remain advisory to avoid automated changes to student data.
- Governance-first defaults reduce privacy and policy risk during rollout.

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

## Rejected Alternatives
- Make district endpoints a filtered national view. Rejected to avoid accidental cross-scope leakage.
- Allow AI recommendations to auto-apply. Rejected to preserve human oversight.
- Require non-null School.districtId immediately. Rejected to avoid breaking legacy data.
