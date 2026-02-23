# Incident Response (V1)

## Severity
- SEV1: platform down, data leak risk, tenant boundary compromise
- SEV2: major workflows broken (login, grading, sync)
- SEV3: degraded performance, partial outages, SMS issues

## SEV1 Immediate Actions
- enable degraded mode
- disable risky subsystems via flags (AI generation, bulk messaging)
- preserve logs and audit trail
- communicate status to affected schools

## Post-Incident
- root cause summary
- prevention tasks
- tests added
- documentation updated