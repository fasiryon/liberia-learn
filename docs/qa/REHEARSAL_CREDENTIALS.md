# Rehearsal and seed secret configuration

Use an explicitly authorized target through `E2E_REHEARSAL_BASE_URL`. There is no default Production target.

| Purpose | Required environment variable |
| --- | --- |
| Legacy student, teacher and school-admin rehearsal | `E2E_DEMO_PASSWORD` |
| MOE rehearsal | `E2E_DEMO_MOE_PASSWORD` |
| Load-test seed and local export | `LOAD_TEST_PASSWORD` |
| WAEC demonstration seed | `WAEC_DEMO_PASSWORD` |

Values come only from the operator secret store. Missing or blank values fail closed. Never put values in command arguments, documentation or reports. Unknown rehearsal accounts refuse; no Production-capable fallback exists. The MOE recording secret is required before the recording module can run.

The load-test exporter writes only ignored `load-tests/fixtures/load-test.env`, with restrictive file mode. It refuses output if Git does not ignore that path. The tracked sample remains value-free. Preserve local OS access controls and delete exported files through the owner's retention procedure. Never include them in CI evidence.

See [validation gating](../security/VALIDATION_CREDENTIAL_GATE.md) for the dependency-free current-file and reachable-history checks and [rotation preparation](../security/SEEDED_CREDENTIAL_ROTATION.md) for remaining owner actions. Source changes do not revoke existing credentials or sessions. Raw browser artifacts may contain input values; they require independent sanitization and must stay out of Git.
