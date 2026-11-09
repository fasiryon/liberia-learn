# Six-lesson integration increment

Branch `fix/v4-pilot-final-repairs` starts from Claude's map/test head `db178bb3e`, already based on `b02fc6764` with both `progressStorage` and `sceneAttachments` present. This change edits the preview wrapper and backend, not Claude's player, registry, geographic renderer or PWA/header components.

- All six exact draft.6 hashes are eligible, including Civics `2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb`. Eligibility alone supplies no rights clearance or approval.
- The policy cap is 128 exact entries to accommodate full-day planning, with bounded IDs, 64 classes and 1024 explicitly listed students. The closed candidate registry currently contains only the six pinned draft.6 packages. Unknown selections or changed hashes invalidate the policy. No unrestricted or latest-version lookup exists.
- A policy spanning multiple classes must name each lesson's class cohort. Cohorts must be subsets of the global allowlist. Current roster membership is checked against the selected lesson's cohort. A schoolwide configuration does not authorize every student for every lesson.
- Optional timetable bindings are bounded arrays of `{classId,timetableId,subject}` and enter the approval digest. They are planning bindings for Claude's read-only day resolver; this increment does not invent timetable rows or claim that unverified period IDs are valid. The day resolver must compare them to actual tenant-scoped timetable slots.
- Civics passes the exact map attachment to the real Lesson Player V2 alongside `progressStorage="MEMORY"`. Both contributions remain intact.
- The pilot banner is in normal page flow, so it does not stack over the sticky scene header at short heights or high zoom. T1 retains ownership of the PWA/header fixes and final browser acceptance.
- Bounded same-tab offline continuation is opt-in; [PILOT_OFFLINE_POLICY.md](PILOT_OFFLINE_POLICY.md) defines expiry, integrity and reconnect revocation. Durable offline reload is not claimed.

Validation before this increment's commit: 179 focused tests passed against the verified disposable PostgreSQL database, including all six package loads, their independent synthetic-test authorizations, the Civics attachment, offline validity, per-lesson cohort denial and zero-write delivery. Every role/cohort/revocation/expiry/tamper/disabled-flag regression remains active. TypeScript passed. The DB suite deactivates its synthetic policy and approval records after use; those records are test fixtures, not human academic approvals.

Database evidence: container `facbf788884f082c15207f9129d5d54a71ad6e5c3f3b2970bd1da3d90e718941`, loopback `127.0.0.1:55447`, SQL database `draft6_preview_validation`, SQL role `preview_test`, PostgreSQL 17.6. The runner discards inherited application/service credentials, rejects environment files and hard-pins this DSN. No production Supabase or shared Vercel Preview was accessed.

Still required: changed-code gate on the committed increment, actual final-code authenticated browser/zoom/offline acceptance with Claude's #199 commits integrated by CoS, clean Linux packaging/security disposition, new school-day exact registry entries after repaired packages pass their gates, and explicit founder release authorization. Do not push, merge, deploy, publish or activate. The flag remains OFF and no real policy is created.
