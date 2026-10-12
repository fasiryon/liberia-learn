# Demo student lab authority

This is a server authorization exception on the existing student Labs surface.
It does not define a demo product mode or change production lab authority.

## Identity

`prisma/seeds/cha-demo.ts` and `scripts/demo-login-sheet.ps1` define the canonical
handout accounts. Only their single STUDENT account is supported here. Its
existing identity constants are shared in `lib/demo/chaStudentIdentity.ts`:

- School ID: `cha-high-academy`.
- Login ID: `CHA-2026-0001`.
- Email: exact `E2E_DEMO_STUDENT_EMAIL`, default `student1@cha.edu.lr`.
- Persisted User role: STUDENT; authenticated role: STUDENT.
- Persisted Student ID must exist and its userId/User ID must match the
  authenticated User ID. Persisted and authenticated school IDs must match.

`loadShowcaseStudentAuthority` reloads persisted identity. Missing records,
stale roles, foreign schools, synthetic national seed students, teacher/admin
accounts and demo-like emails fail closed. Environment configuration only
selects the existing seed email; development/localhost/DEMO_MODE grant nothing.
Existing seed upserts do not repair missing login IDs or school affiliation;
such historical records fail closed, with no migration or live mutation here.

## Capability and discovery

`canAccessShowcaseLab` in `lib/student/showcaseLabs.ts` grants access only to:
`g4-solid-figures`, `fixture-lever`, `fixture-simple-circuit`, and
`mount-coffee-hydropower`. Both discovery and `/student/labs/[labId]` use it.
The compatibility interactive-labs URL redirects to this protected route.

The server adds the four entries to the existing Library collection, regardless
of the showcase student's grade, with their original unreleased metadata.
It does not add governed For You links, assignments or completion entries.
Normal filtering and practical assignment/session authorization are unchanged.
The 12 legacy uncertified labs remain hidden and their static routes blocked.

## Runtime and evidence containment

The server passes the existing `internalPreview` host capability to the existing
InteractiveLabPlayer only after authorization. This capability allows local
interaction with an unapproved definition; it is not API authority. The player
uses the existing kernel and keeps state/check results in browser memory.
It makes no session/evidence submission requests. No LabSession is needed or
created, no score/completion is persisted, and reload discards showcase progress.
Lever retains its existing minimal fixture transition (a no-op except reset);
this authorization slice does not add simulation or assessment behavior to it.

The interactive events API keeps its production certification gate and rejects
these four labs, including forged PREVIEW submissions. Practical session APIs
and offline session sync retain `loadAuthorizedPracticalSessions`, which excludes
interactive registry IDs. Thus an existing or forged session does not grant a
showcase lab production completion, assessment or mastery authority.

No release, approval, binding, curriculum objective, lesson linkage, governance
evidence or registry certification is changed. Certified released count remains
zero; legacy uncertified count remains twelve. Solid Figures retains its pending
objective/review metadata; Lever/Circuit retain their fixture bindings.
Mount Coffee remains DRAFT/PENDING, UNRELEASED, curriculum inactive and
DO_NOT_SHIP under `docs/labs/mount-coffee-hydropower/STAGE_B_REVIEW.md`.
No governed G8 Science binding is created.

## Validation scope

Focused authority tests exercise exact allow/deny identity and lab matrices,
server discovery/direct routes, stale identity and rejected evidence writes.
The real player is mounted in jsdom in FALLBACK_2D for all four labs to verify
local runtime startup without network persistence. This is not physical-device,
WebGL performance or production certification evidence.
