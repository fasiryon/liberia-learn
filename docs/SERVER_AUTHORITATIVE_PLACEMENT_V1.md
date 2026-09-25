# Server-authoritative placement V1

This work closes December assurance findings D01 and F11
(`docs/audits/2026-09-december-assurance-audit-v1.md`). Placement is now issued,
scored and recorded by the server. Changing a learner's official grade is a
separate human authority.

## Authority

| Actor | May | May not |
| --- | --- | --- |
| Learner (browser) | render an item, choose an option, and submit `{itemId, itemVersion, selectedIndex, operationId}` | receive a key, explanation or correctness before submitting; submit correctness, score, band or grade (rejected with `client_authority_fields_rejected`) |
| Server (`lib/placementAuthority/sessionService.ts`) | issue items, hold keys, score responses, derive score/band/recommendation, and record `PlacementTest` (`source=server_session`) | change `Student.currentGrade` |
| `PLACEMENT_REVIEW` (TEACHER, ADMIN) | inspect evidence and append a `PlacementReview` (`endorse` or `adjust`, where `adjust` needs a note of 20+ characters) | change the grade |
| `PLACEMENT_CONFIRM` (ADMIN and platform admin) | create the one immutable `PlacementDecision` and set `Student.currentGrade` | rewrite the assessment result |

Other rules:
- Overriding the recommendation requires a reason of 20+ characters.
- Confirming a `legacy_client` result always requires a reason.
- The recommendation, the evidence, the actor and the time are all preserved and audited (`placement.official.confirmed`).

## Session model

`PlacementSession` holds the learner, school, assessment version, grade range,
number of items, status (`ACTIVE`/`COMPLETED`/`EXPIRED`), expiry (2 hours) and
the resulting placement.

Each `PlacementSessionItem` stores:
- the issued content;
- its content hash (`itemVersion`);
- the answer key;
- a response that can be written only once (`selectedIndex`, `isCorrect`, a unique `responseOperationId`, `respondedAt`).

Protections:
- **Refresh:** reissues the pending item instead of creating a new one.
- **Replay:** the same `operationId` returns the stored result.
- **Changed answer:** returns 409.
- **Cross-session item:** returns 404.
- **Altered version:** returns 409.
- **Expired session:** returns 410.
- **Double completion:** returns the same `PlacementTest`.

Items come from AI generation on the server, with the server-only item bank
(`lib/placementAuthority/itemBank.ts`) as a fallback. A test forbids client
components from importing placement authority modules.

## Database (repository-side only)

`prisma/canonical/migrations/20260924_000001_server_authoritative_placement`:
- four tables, created with RLS enabled and no anon/authenticated grants;
- triggers that make reviews and decisions append-only;
- a trigger that makes item content immutable and responses write-once.

The migration is **not applied** to staging or production. Applying it needs
the normal migration runbook and database approval.

## Retired

The following endpoints now return `410` with `code: placement_endpoint_retired`:
- `POST /api/student/placement`
- `POST /api/placement/generate-question`
- `POST /api/placement/calculate-grade`

`components/PlacementTest.tsx` (unused, and it contained answer keys) was removed.

## Policy decisions landed with this change

- **WAEC:** national WAEC readiness stays restricted to MOE roles; school admins remain school-scoped (landed in PR #142).
- **AI aggregates:** AI district-update and MOE-report tools apply the 5-learner small-cell suppression rule (`lib/waec/suppression.ts`).
- **Portal gates:** `/student`, `/teacher` and `/guardian` have middleware role gates as defense in depth (`portalRoleRedirect`). Platform admins are exempt, and teachers' pages allow ADMIN.
- **Discussion replies:** a reply's `parentPostId` must belong to the same thread.
- **Portfolios:** no anonymous portfolio sharing was introduced; share codes still require a session.
- **MOE live display:** it requires an MOE session. `/api/moe/live-token` returns 410 until a governed kiosk/display credential is approved.
