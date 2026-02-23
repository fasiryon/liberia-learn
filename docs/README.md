# LiberiaLearn Documentation

LiberiaLearn is a national-scale education operating system designed for Liberia:
- Low computer literacy environments
- Low bandwidth and intermittent connectivity
- Offline-first operation
- Multi-tenant school isolation
- Government-grade reliability, auditability, and compliance readiness
- AI-assisted curriculum and instruction workflows

This documentation set is a **core deliverable** of the project.
No major feature is considered "done" unless documentation, telemetry, and rollback plans exist.

## Quick Start (Where to Read First)
1. Vision & Phases:
   - `docs/vision/NATIONAL_PHASES.md`
   - `docs/vision/NATIONAL_ARCHITECTURE_WHITEPAPER.md`
2. System Architecture:
   - `docs/architecture/SYSTEM_OVERVIEW.md`
   - `docs/architecture/TENANCY_ISOLATION.md`
   - `docs/architecture/OFFLINE_FIRST.md`
3. Governance:
   - `docs/governance/VERSION_GOVERNANCE.md`
   - `docs/governance/DATA_GOVERNANCE.md`
   - `docs/governance/SECURITY_MODEL.md`
4. Operations:
   - `docs/ops/RUNBOOK.md`
   - `docs/ops/INCIDENT_RESPONSE.md`
   - `docs/ops/RELEASE_PROCESS.md`

## Documentation Rules
- Any PR that changes behavior must update relevant docs.
- Any PR that adds a new major capability must include:
  - telemetry plan
  - feature flag / kill switch (if applicable)
  - rollback plan
  - security impact review
  - offline-first impact review (if applicable)