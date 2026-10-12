# Lesson Experience V2 production delivery seam

`GET /api/student/lessons/:id/experience?version=<exact-version>` is the read-only
authority seam for the Product Design V2 player. `id` accepts a stable
`CurriculumContent.contentId` or an enrolled `ScheduledWork.id`. The content and scheduled-work routes both consult this seam. Omit `version` to resolve the current
authorized version; a requested mismatch returns 409 `INCOMPATIBLE_VERSION`
with `compatibility: UNAVAILABLE` and no lesson payload. Missing, restricted,
foreign-school records return indistinguishable 404. After scope authorization, native denials identify `format: NATIVE_V2` and `reason: NOT_RELEASED|NOT_STUDENT_READY` (404), or `REVOKED` (410). Authentication failures retain
401/403. Responses use `private, no-store` and `Vary: Cookie`.

## Authority inventory and reuse

| Concern | Existing authority reused |
| --- | --- |
| Native generation and scenes | `CurriculumLessonV2`, `toLessonExperience`, strict `projectStudentLessonPayload`, `validateLessonExperience` |
| Exact instructional revision | `CurriculumProvenance`, `CurriculumContentRevision`, native snapshot schema 2, `buildCurriculumContentSnapshot`, `hashCurriculumSnapshot` |
| Human approval | latest lifecycle `CurriculumGovernanceEvent`, `assertNativeCurriculumV2Approval` |
| Release visibility and identity | `publishedRelease`, `deterministicReleaseIdentity`, exact `contentBindings`, optional payload hash pin |
| Objective/resource resolution | `governedInventoryForRelease` and its exact-version lesson/concept/objective inventory |
| Learner access | session `requireRole(STUDENT)`, `loadLearnerScope`, `learnerMetadataAllowed`, `learnerLifecycleAllowed`, `learnerScopeAllows` |
| Labs | `LearningExperienceLink`, `validateExperienceLink`, `isLinkStudentVisible`, existing certified-lab/version registry and grade gate |
| Assessments | existing `AssessmentHandoff`, published release items and inventory activities |
| Evidence | `evidenceHandoff` and server `evidenceAdapter`; Evidence → SLM → DecisionModel → Learning Orchestrator |
| Offline | existing signed content availability manifests, session-partitioned offline caches and versioned experience progress; this endpoint grants no new offline admission authority |

Native generation remains draft. No release registry, approval, certification,
curriculum binding, database schema or UI change is made by this slice.

## Delivery contract

`LessonExperienceDelivery` in `lib/lessons/lessonExperienceDelivery.ts` contains
`lessonId`, `lessonVersion`, `releaseId`, `releaseIdentity`, `revisionId`, title,
subject, grade, age band, existing objectives, objective IDs, safe scenes and scene
IDs, authorized lab links, assessment refs, compatibility, evidence disposition,
offline policy and a small provenance identity. Native and legacy data are mutually
exclusive: native delivery has scenes and `legacyPayload: null`; legacy delivery
has the existing safe projected payload and empty native scene/objective arrays.

Identity comes from persisted lesson/version, authored scene/objective IDs,
published release identity and the current exact revision. Scene positions never
serve as authority. Legacy objectives have no invented canonical IDs.

Native delivery requires all of the following in one repeatable-read transaction:

- Student role, school identity and the existing authorized platform/own-school
  production access route. Class-only content requires an own-school enrollment
  and scheduled-work or teacher assignment; a scheduled-work alias also requires
  membership in that specific class.
- Published/approved lesson status, learner audience/visibility restrictions and
  active curriculum version where present.
- APPROVED provenance and latest revision matching the current revision; native
  snapshot schema 2 and recomputed instructional snapshot hash matching approval.
- Latest lifecycle event approves that exact revision through an identified,
  qualified human, using the existing native governance rule.
- Published and reviewed release, matching release identity, grade and subject,
  exact lesson/version binding and any existing payload hash pin.
- Governed inventory lesson and every delivered objective/concept resolved through
  the inventory and release bindings. Missing curriculum identity fails closed.

An older release binding without a payload hash does not bypass the exact approved
native snapshot hash. No new hash or release authority is inferred from a payload.

## Learner projection and links

The existing strict learner projection strips authoring/governance internals.
Delivery further removes **all** formative `correctIndex`, feedback and option
feedback fields. The narrow `LearnerScene` interaction type adds
`feedbackAuthority: SERVER_REQUIRED`; the UI owner must handle that contract before
enabling correctness feedback. The existing keyed `LessonExperience` authoring
type is not weakened or falsely cast to a safe player payload.

Lab links come only from the approved instructional artifact, never subject/grade
matching or the four demo showcase labs. Each link must have approval provenance,
exact lesson/lab versions, valid scene/objective placement, grade appropriateness
and independent runtime certification. Delivery provides lab ID/version, label,
scene ID, exact `launchContext` and a typed `returnTarget`. Launch queries reuse
`labLaunchQuery`; they grant no standalone lab access. Unavailable lab launches
become read-only scenes with no lab evidence action. The student runtime uses the authorized context with its actual route origin. The production certified-lab registry is currently empty.

Assessment refs contain only existing handoff identity, version, objectives and
item ID/version/prompt/options. Prompts and options are reloaded from published
release items; each item must map to a lesson objective through governed inventory.
Missing items or mappings deny native delivery. Keys, hints, worked solutions and
scoring data are never returned. The later Assessment Player must resolve and
authorize these references again; this seam creates no assessment session.

## Evidence, cache and version trust

Current delivery is `OBSERVATION_ONLY`, `masteryMutation: false`,
`authoritativeSubmission: false`, `submissionEndpoint: null`. The existing server
evidence adapter is the named future handoff, not a newly enabled write endpoint.
Clients cannot promote observations to scores, mastery or next-action authority.

An authorized, learner-partitioned cached copy may be presented read-only under
the existing cache/trust rules. This endpoint returns no signed offline trust
manifest and cannot authorize a new offline download. Offline observations are
`OFFLINE_PENDING`; absence/loss of current authorization is `READ_ONLY` (and requires
cache purge on known access loss); changed lesson/version, release identity or
revision is `INCOMPATIBLE_VERSION`. `deliveryTrustDisposition` compares these
identities for presentation only and grants no submission token. Reconnect must
reload authorization/release/version before any future evidence admission.
All authoritative submission remains disabled even when identities match.

The V2 player presents native scenes; the existing offline transport retains cache admission authority. No cached object or client
claim can assert canonical state. Historical legacy content stays
`LEGACY_COMPATIBLE` through the existing safe projection and current legacy
visibility rules, without being forced into native scene format.

## Handoff and limitations

The production registry currently has no released native V2 lesson binding; native
positive tests use isolated mocked authority only. This seam truthfully returns
unavailable until authorized humans publish the necessary exact-version resources.
It does not approve or fabricate them. Existing curriculum listing/Tutor paths
retain their fail-closed native visibility rules; this dedicated endpoint is the
new production scene authority seam for UI integration.

Focused server tests cover A–K, exact-revision tampering, release/objective mismatch,
scheduled-work aliases, route role/transaction/cache behavior, and assessment
reference reconstruction. No production/staging data is used or changed.

## Convergence inventory

| Owner | Responsibility |
| --- | --- |
| AUTHORITY | Student delivery endpoint; curriculum/release/provenance; learner scope; exact version; approved-link and certified-version lab authorization; keyless assessment projection; observation-only evidence disposition; offline trust policy |
| RUNTIME | Lesson Player V2 and all 12 renderers; stable scene navigation/resume; native versus legacy presentation; responsive and age-band UX; lab launch/return presentation; unavailable/revoked/incompatible states; cached read-only presentation; future governed evidence adapter slot |

The convergence branch preserves source commits
`71f56969846256d45d86d333ece17c591827765b` (authority) and
`f73866570d44897036617a7655d7da68d7fb5168` (runtime) as merge ancestors,
on main `710faad28bb4641126eda4d27cb26f49dffaa5d1` (including PR #181/#182).

## Route identity and resolution

`lessonRoute.ts` owns `LessonRouteTarget`, `LessonReturnTarget`, the canonical URL builder and `rt` encoder. Delivery contract `lesson-experience-delivery/1.1.0` carries server-resolved `routeTarget`. `LessonRouteTarget` is one shared discriminated contract:
`CONTENT { contentId }` names `/student/lesson/:contentId`;
`SCHEDULED_WORK { scheduledWorkId, contentId }` names `/student/lessons/:scheduledWorkId`.
The API accepts `kind=CONTENT|SCHEDULED_WORK` to avoid alias collisions; callers
omitting it retain the original content-then-work lookup. `version` still requests
an exact version. The runtime rejects a native delivery with a different content ID.

Assignments consult delivery first, before the legacy work API, including native lessons retaining legacy body
text. Direct scheduled-work resolution checks the exact school/class scope without date windows or creation side effects. Successful `NATIVE_V2` uses the player, `LEGACY_COMPATIBLE` uses the existing
renderer, and failed assigned delivery uses an explicit unavailable state. The
content route retains its authorized legacy detail path (including historical
teacher-created lessons); a native detail payload cannot bypass failed delivery.
A missing or malformed native projection fails closed. The client does not infer
approval from empty bodies or release eligibility from payload metadata.

## Safe lab handoff and return

Each authorized link carries `launchContext` with exact lesson/content ID, version,
scene ID, link ID, objective IDs and activity ID, plus lab ID/version and typed route
identity. `returnTarget` is `{ route: LessonRouteTarget, sceneId }`; the DTO emits no raw launch/return URL. Assigned launch activity IDs identify the exact assignment. The runtime uses the server context with the route actually opened. The
query encodes `rt=c:<contentId>` or `rt=w:<scheduledWorkId>`; it accepts no return URL.
Content returns must identify the context's content ID. Malformed IDs and route tags
are rejected, and return addresses are built only under the two student lesson paths.

The lab server page repeats delivery authorization in a repeatable-read transaction,
using the route kind and exact version. It requires the same authorized link and
exact context and runtime lab version; changed content, version, lab version, link, scene, objectives or activity deny
lesson-origin access. Return restores the stable scene ID. A lab return is a local
presentation observation; neither the query nor its sessionStorage observation is
educational authority. Showcase visits without lesson-origin parameters retain
separate demo access. All four showcase IDs are explicitly regression-tested against
lesson-link authority; a showcase grant supplies no approved link or certification.

## Assessment, evidence and offline presentation

Learner delivery contains item ID, prompt and options with `SERVER_REQUIRED` feedback.
The live delivery parser rejects keyed MCQs, correctness metadata and scoring feedback. Historical formative keys in an admitted cached projection are discarded before
rendering. No student V2 interaction fabricates correctness. Assessment handoff is
observation-only until an existing authorized server scoring adapter is connected.
`authoritativeSubmission=false`, `masteryMutation=false`, and
`nextActionAuthority=LEARNING_ORCHESTRATOR` remain unchanged. Production routes inject
no evidence submission channel. No scene, lab, practice or offline completion writes
canonical mastery.

Admitted cached native content allows viewing, navigation and local stable-scene
resume, with no lab launch, grading or evidence submission. Cache identity/version
mismatch is `INCOMPATIBLE_VERSION`. Reconnect reloads server delivery; changed version,
release identity or known revision refuses the copy, and access loss purges the cache.
Matching reauthorization restores current presentation. Cache signatures and learner
partition admission stay owned by the existing offline subsystem.

## Validation and artifact policy

Server authority tests, runtime route tests, explicit handoff tampering tests and
Playwright probes cover native content and assigned routes, all 12 scenes, safe
unavailable states, no certified lab, return continuity, cached read-only presentation,
legacy compatibility, stable resume, version restart, keyboard focus and age bands
at widths 320/360/390/768/1280/1440. Browser responses and cache admission are synthetic
test-only fixtures; they do not certify any production release or hosted data.

The runtime source history preserves its original visual artifacts. The convergence
tip retains a small representative reviewed screenshot set and machine-readable
results; redundant generated captures are excluded from the final product diff.

## Remaining production limitations

There is still no production released native V2 lesson binding and the certified-lab
registry is empty. No curriculum, approval, release or lab certification was fabricated
or published for this integration. Positive native/lab tests use isolated synthetic
authority fixtures. Before learner scope authorization, missing/restricted records remain indistinguishable. After authorization, native denial format/reason is explicit and cannot invoke legacy fallback. Positive states are tested with synthetic server responses. There is no production
V2 scoring/evidence endpoint, and this seam does not create a signed offline package.
Media without supported local assets uses its authored text alternative/transcript.

The legacy detail enrichment fetch is retained because delivery does not carry the
legacy audio, video and delivery metadata required by existing working lessons.
Native assigned delivery makes no legacy work request; existing completion is read
from scoped progress, and no new completion persistence is introduced. Repeated
options and key points use position-qualified React keys. Unavailable assigned
lessons offer Back to Today; content lessons offer Back to Learn.

## Final local verification

The full suite passed 7,059 tests (8 skipped), and final cache-purge/handoff/denial
regressions passed 89 tests. The named required groups passed 363 tests across
22 files. TypeScript, lint (existing warnings), `validate:changed` and the
production build passed. Windows standalone packaging needed a local build retry
outside the sandbox; its final exit status was zero. The emitted production chunks
were inspected to confirm the final cache-purge guards are included.

Playwright passed 12 layouts, three content lesson flows, the exact assigned
lesson return, six unavailable/lab states, cached read-only presentation and
keyboard focus, with no serious/critical axe findings or page errors. These are
synthetic presentation probes, including a navigation-only lab leg, not evidence
of a production curriculum release or certified lab run. Machine-readable details
are in `artifacts/lesson-experience-v2-runtime/convergence-validation.json` and
`results.json` beside the 13 retained reviewed captures.
