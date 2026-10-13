# ContentBundle Wave 2 integration

Converges Wave 2A Teacher Preview (`f99134ded0a181ffffcf71c1ca0369999f134c95`)
and Wave 2B read-only resolver (`48cf8501ac4fb0a1aff978f38422050a4900e4b2`),
from exact main `f28f71070ba2676b28aab59502146dd187886608`.
The two source documents remain as slice records:
[Teacher Preview](CONTENT_BUNDLE_TEACHER_PREVIEW_V1.md) and
[Resolver V1](CONTENT_BUNDLE_RESOLVER_V1.md). This integration supersedes the
Wave 2A automatic development-fixture / production-disabled server selection.

## Integrated request and authorization boundary

`/teacher/content-bundles/[bundleId]/preview?version=<exact>`:

1. `requireRole("TEACHER", "ADMIN")` resolves the existing authenticated session.
2. The server requires a non-null school context. An optional school query must
   equal the caller's school; the existing `assertSchoolAccess` helper confirms
   that scope. Platform-admin national bypass is deliberately not enabled here.
3. `canPreviewBundle(scope, bundleId)` authorizes bundle membership before any
   sensitive authority reader is constructed. The repository implementation
   allows only the known national fractions readiness navigation slice.
4. `createReader(scope)` supplies read-only authority adapters bound to that
   authorized school. Each future stored query must include this scope, including
   revisions, resource/media records and compositions. These dependencies are
   server-created functions, never request-supplied approval or scope claims.
5. With an explicit version, the integration calls Wave 2B
   `resolveContentBundle({bundleId, bundleVersion}, reader)`. It captures the
   same release/inventory/mapping/native-revision reads for display metadata;
   it performs no extra global or sensitive metadata queries.
6. The server converts success into separate teacher/student display models.
   React receives these bounded models, never raw source snapshots or errors.

Cross-school, missing-school, unauthorized-role and unscoped bundle requests
fail before sensitive reads. The page redirects absent/unauthorized sessions
through its existing login behavior. Resolver scope denials display an
unavailable state without exposing whether another tenant owns that bundle.
No public unauthenticated API route, security architecture, DB mutation,
migration, publication or deployment was added.

## One resolver contract and projection boundary

Preview success extends the Wave 2B discriminated `ContentBundleResolution`:
`status`, `bundle`, `learnerProjection`, `diagnostics`, plus display metadata.
Failure uses the same `UNAVAILABLE` / `INCOMPATIBLE` statuses and null content.
Old `NOT_FOUND`, `INVALID` and `RESOLVER_UNAVAILABLE` authority statuses are
removed. Display source labels, ontology release labels, tool mappings and
readiness facts are not a second approval ledger.

`buildPreviewModels` uses the supplied `learnerProjection` for the entire student
model. It never calls the projection function, hashes, or merges teacher content
into student content. Student headers, navigation, item titles, instructions,
resources and selection announcements use only this model. The former
teacher-derived counts sidebar is now a static boundary explanation.
Teacher mode keeps appropriate secured references and resource metadata;
internal configuration values and raw governance refs are withheld even from
the client teacher display model. The preview never delivers question keys or
scoring content.

Synthetic markers derive from the projected identity/version for student
labelling. Fixture material cannot become production authority through a
different navigation ID: production rejects fixture release/version/source
markers after resolution as well as direct `fixture.*` navigation before reads.
The explicit legacy fixture display adapter remains test/development-only and
must be requested with `?fixture=1`; it is not a governed production resolver.
Local example:
`/teacher/content-bundles/fixture.bundle.g4-math-fractions/preview?fixture=1`.
It remains clearly labelled unreviewed/unreleased. Its single registered
synthetic version is a test-preview choice, not a classroom selection rule.

## Versions and diagnostic states

An explicit `version` is passed unchanged to Wave 2B. Empty values and mutable
`latest`, `current`, `*` aliases fail closed. Another exact version never falls
back to the available composition. No reviewed immutable composition version
selector exists at this base: omitted versions return `UNAVAILABLE` with
`VERSION_SELECTION_REQUIRED`, without opening composition readers.

| Resolver state | Display |
| --- | --- |
| RESOLVED | Normal teacher / server-projected student preview |
| UNAVAILABLE | Content unavailable for preview, with safe readiness blockers |
| INCOMPATIBLE | Bundle cannot safely be resolved; all content withheld |

`teacherDiagnosticMessages` maps codes to fixed teacher-readable messages. It
never echoes internal paths, validator/provider messages, unknown code strings,
SQL, secrets or answer-bearing data. Unknown codes get a generic dependency
failure. Raw resolver diagnostics stay on the server; React receives messages.
`teacherDiagnosticGroups` groups those messages by reason so a teacher can tell
"Not available to you here" (access or production refusal), "Not built yet"
(missing composition, definitions, pins, packages), "Not reviewed or approved yet"
(toolkit mapping, lab certification, revision/rights verification) and "Cannot be
resolved safely" (exact-version and identity failures, plus every unknown code).

## Objective, toolkit, lab and offline display

Objective descriptions come from exact approved native objective statements
when present. Otherwise a governed inventory/ontology join supplies the exact
concept label, explicitly labelled `Ontology concept: ...`, not invented MOE
objective wording. The fallback is the objective ID plus `description unavailable`.
No descriptions are duplicated into ContentBundle authority or inferred in React.

Canonical tool IDs remain unchanged. Runtime tools are displayed only when the
resolver supplies a mapping and the injected `isReviewedToolkitMapping` attests
its review (absent means unreviewed; a governed source alone never implies review); unreviewed/unresolved mappings display
`Mapping unresolved`. Student mode uses only the allowed tools in the server
projection. No runtime tool or approval is guessed from spelling or registry names.

Wave 2B rejects all current production lab bindings because
`LearningExperienceLink` lacks stable `linkRevision`; no revision is synthesized.
The explicit fixture lab variant is test-only and non-runnable. Even a claimed
fixture `CERTIFIED_RUNNABLE` flag cannot make the UI show certification or launch.

Offline display retains exact bundle/version/hash, member and asset pins,
byte/count summaries, capabilities and reconnect requirements. Packageability
is not package closure: the real package is labelled **not yet ready**. Student
mode does not claim that a package is downloadable. Weekly packs are not
represented as bundle-safe packages.

## Real Grade 4 fractions readiness and production blockers

**PARTIAL** remains the repository finding. The production path now invokes
the resolver for an explicit requested version and shows structured blockers,
even with `NODE_ENV=production`. The existing national readiness navigation
`g4-math-fractions` is not allocation of a production bundle identity. There is
no stored bundle/version/hash to return; `bundle` and `learnerProjection` are null.

Available authority: published founder-reviewed ontology
`lr-moe-g4-math-fractions-2026.1`, MOE NOT_CLAIMED; mapped objective
`moe-math-g4-s1-p3-number-theory-and-fraction-obj4`; one lesson reference at
`1.0.0`; three governed item identities. None of this approves the missing
parts-of-a-set production bundle or promotes the 2026.2 candidate.

Visible blockers include production bundle not sealed; unverified source
version/rights and exact stored approved revision; missing released lesson
payload hash; assessment bank/definition/item authority gaps; reviewed activity
revisions; toolkit mapping not reviewed; resource/media revisions; lab revision/
certification unavailable; offline package not closed.

The production repository adapter intentionally returns null for missing stored
composition/revision/source/media/asset adapters. There is no hidden fixture
fallback or mutable current-row query. A future authority handoff must supply
reviewed immutable compositions and scoped exact readers using existing governed
systems. That is a production blocker, not a reason to fabricate a success state.

## Validation evidence and browser limits

Focused resolver, ContentBundle, original preview and integration tests cover
teacher/admin success through synthetic authority readers, early authorization,
school scope, version selection, all UI states, server projection precedence,
keys/resources/governance/configuration secrecy, mapping states, lab blocking,
real PARTIAL diagnostics, production fixture rejection and unchanged input state.
Tests make DB-client imports fail to prove resolution has no database write path.

The localhost Vite SSR harness runs the integrated service and real Wave 2B
resolver with explicitly synthetic readers, then renders the production React
components. It verifies 320–1920px teacher/student layouts, keyboard and touch
targets, no overflow, eight learner views without leaks, test-only lab display,
and UNAVAILABLE/INCOMPATIBLE/lab-blocked diagnostics at 320px and desktop.
Evidence is in `artifacts/content-bundle-wave2/`.
**Logged-in real Next middleware/session flow is not exercised by this harness.**
Its server authorization uses explicit test session fixtures; production/hosted
authentication and authority availability are not claimed.

Required checks: resolver/preview/ContentBundle tests, repository TypeScript,
changed-file lint, `validate:changed`, local production build, and browser harness.
The local build uses loopback-only unreachable DB URLs and a local build auth
secret; it cannot reach hosted data or publish/deploy content.

Final local results: 161 focused tests passed (34 resolver, 80 foundation,
29 preview, 18 integration); changed-file lint, TypeScript and `validate:changed` passed.
The final production build exited 0, generated 387 static pages and compiled
the dynamic preview route. Windows standalone tracing still reported `EPERM`
when copying the dependency-junction symlink, including outside the filesystem
sandbox. Thus compilation/build passed, but a portable standalone deployment
artifact is not verified on this host. Existing unrelated lint/instrumentation
and missing local optional-service warnings also remain. No deployment is implied.
The final browser harness passed 14 layouts, eight student pages and six
diagnostic-state/width checks, with no detected overflow or learner leakage.

## Pre-merge audit fixes (fix/content-bundle-wave2-audit)

The pre-merge audit of `000f883d` found no blocker. Three should-fix items were
corrected on top of it:

1. Lesson payload digests use the release registry convention
   (`lessonPayloadSha256`: SHA-256 of `canonicalizeJson(payload)`), not
   `JSON.stringify`. The previous check failed closed for any canonically bound
   lesson, including the 2026.2 successor binding. The synthetic fixtures used the
   same non-canonical digest, which hid the divergence.
2. Preview authority is declared, never inferred. A resolution is authoritative
   only when `PreviewDependencies.source.authoritative === true`. Identifiers
   without a `fixture` marker no longer imply governed authority, a released
   ontology, READY readiness or a reviewed toolkit mapping. Production withholds
   undeclared sources (`AUTHORITY_UNDECLARED`).
3. Unavailable/incompatible states group diagnostics by reason, and the teacher
   offline row no longer shows a green "Yes" beside "not yet ready".
