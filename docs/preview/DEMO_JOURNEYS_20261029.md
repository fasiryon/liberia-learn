# Isolated LiberiaLearn Preview journeys

This is a protected, synthetic-data Preview candidate, not a production release. No working hosted URL or browser acceptance is claimed by this document. CoS deploys only the exact independently accepted candidate after private CI, authenticated browser checks and resolved-environment verification.

## What the lessons mean

| Grade 4 slot | Classification | Release boundary |
| --- | --- | --- |
| P1 Mathematics | Academically accepted, AI-assisted internal | Sealed pilot package; not published or MoE approved |
| P2 Science | Academically accepted, AI-assisted internal | Sealed pilot package; not published or MoE approved |
| P3 English | Academically accepted, AI-assisted internal | Sealed pilot package; not published or MoE approved |
| P4 Social Studies | Academically accepted, AI-assisted internal | Sealed pilot package; not published or MoE approved |
| P5 Computing | Academically accepted, AI-assisted internal | Sealed pilot package; not published or MoE approved |
| P6 Engineering Design | Academically accepted, AI-assisted internal | Curriculum classification provisional; not an evidenced official MoE subject |
| P7 Support | Academically accepted, AI-assisted internal | Teacher-guided misconception support, not automated diagnosis |
| P8 End of Day | Academically accepted, AI-assisted internal | Reflection, not an assessment or mastery decision |

All eight exact selections and package hashes are pinned in `lib/curriculum/v4/schooldayPackage.ts`. All delivery/publication flags remain false. The fixture policy and its approval/audit rows are **synthetic demonstration only**, not genuine release authorization. Accounts, class, assignment, attendance, consent/onboarding fixtures and test responses are also **synthetic demonstration only**.

## Student

1. Pass Vercel Authentication, then sign in with the synthetic student credentials shown once in the operator's private console. Credentials are never placed in this document or mailbox.
2. Open `/learn/day`. The synthetic timetable binds the eight slots in order to the exact accepted hashes. Open a lesson through its slot.
3. Use the real formative activities: the Computing trace distinguishes set from add; Support frames a mistake then gives the correct idea and a fresh retry; Engineering permits a second design after a successful first attempt and compares each design's own results.
4. In Engineering, identify the evidence source. Browser tests use explicitly supplied synthetic observations, not physical tests. The accepted package asks for a paper graph of the counts. Missing real observations must never be invented.
5. Complete the End of Day reflection and the pilot-only finish panel. No official grade, mastery, promotion, assignment completion or academic record is written. The existing offline alternative is a short, verified in-memory lease, not an indefinitely downloaded course.

## Teacher

1. Sign in as the synthetic class teacher and open `/teacher/schedule`. Inspect the synthetic class and its eight periods.
2. Existing class authority permits the Grade 4 learner's advisory misconception view. No diagnostic or intervention effectiveness is inferred from empty synthetic evidence.
3. The second-school teacher must receive a non-disclosing 404 for that learner view and 403 for the foreign class attendance route.

**Unfinished:** the pilot player persists no formative progress, so teachers cannot see a learner's progress through this eight-lesson day. A governed formative-evidence write and teacher progress surface require a separate product/authority decision. The schedule and existing advisory views do not establish that missing capability.

## School administrator

1. Sign in as the synthetic school ADMIN, not the separate synthetic approval-authority account. Open `/admin`.
2. Inspect the synthetic school and three-learner roster. `/admin/placements` is a read-only demonstration of an empty placement queue, not a fabricated placement decision.
3. `/admin/report-cards` exposes the school class selectors. No academic year, report card, transcript or official grade is fabricated to make the interface appear complete.
4. The sample assignment has no prefilled submission or score. The one attendance row is visibly labelled synthetic and does not describe a real child's presence.

## Controls and limitations

- Production builds reject `DEMO_MODE=true` before plugins, independently of skipped env validation. Runtime production identity cannot be switched off by demo or test flags.
- Google OAuth is registered only with both keys present. The separate Preview intentionally has no OAuth keys; credentials-provider login must work and unavailable OAuth must not authenticate or redirect externally.
- The isolated Preview deliberately lacks AI, messaging, payment, storage, Redis and Sentry credentials. AI availability degrades; no live provider outcome is demonstrated. Preview rate limiting is bounded per instance, not a distributed production limit. Production still requires Redis.
- Preview and staging refuse both cron namespaces in middleware before exemptions; the two legacy handlers also refuse before authorization or work. Production cron behavior is unchanged.
- The final candidate needs private type/build/route checks, the actual disposable-DB student/teacher/admin suite and Atlas's exact-SHA acceptance. Unit tests and test discovery are not browser acceptance.
- Authenticated Preview access is restricted by all-deployment Vercel Authentication and synthetic application accounts. No real users, production records, source push, main merge, curriculum publication or production deployment is authorized.
- The existing Next 14 security/release limitations remain separate blockers. This candidate includes only the scoped independently accepted PROD-CFG change, the reviewed G4 admission lineage and explicit new Preview repairs awaiting review. It does not silently incorporate the unrelated GAM, platform, placement, sentiment or dependency repair branches.
- UI/UX comparison must use actual protected Preview screenshots at 1280/768/375 and the founder's two original reference images. They are quality benchmarks to surpass, not layouts or assets to copy. No screenshot-based assessment has been claimed before a Preview renders.

## Operator setup and rollback

The reviewed operator entrypoint remains `node scripts/preview/setup-preview-db.mjs --env-file C:\liberia-learn\.env.preview.local --operator-console`. It reads the same synthetic identities as the test harness from a shared JSON contract, without importing TypeScript or requiring native TypeScript support. The successor still needs the coordinated Node 20.20.2 check; a local Node 24 pass alone is not that evidence.

The setup explicitly loads the ignored Preview credential file, validates both URL targets against the pinned Preview project (`PREVIEW_PINNED_PROJECT_REF`, runtime configuration) and the restricted `preview_app` role, and refuses production ref `bnphuinpvgpmebcsvmsp` or an unexpected existing public schema. It requires a real private Windows operator console before connecting. Passwords are generated once to that console; only counts and synthetic IDs enter the receipt. It uses a dedicated Prisma config without dotenv loading and pins both schema-child datasource variables to the validated direct URL. No migration history or production schema is changed.

Rollback is owned by the coordinator: remove only the verified separate Preview deployment, remove only that project's Preview env, and pause/delete only the Preview database or revoke its dedicated role through the approved operator procedure. Never promote, roll back or alter Production. No teardown has been executed.
