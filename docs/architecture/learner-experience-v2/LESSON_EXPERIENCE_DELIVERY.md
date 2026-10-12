# Lesson Experience V2 production delivery seam

`GET /api/student/lessons/:id/experience?version=<exact-version>` is the read-only
authority seam for the Product Design V2 player. `id` accepts a stable
`CurriculumContent.contentId` or an enrolled `ScheduledWork.id`. Existing lesson
deep links and handlers are unchanged. Omit `version` to resolve the current
authorized version; a requested mismatch returns 409 `INCOMPATIBLE_VERSION`
with `compatibility: UNAVAILABLE` and no lesson payload. Missing, restricted,
unreleased and foreign-school records return 404. Authentication failures retain
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
scene ID, server-built launch query and return target. Launch queries reuse
`labLaunchQuery`; they grant no standalone lab access. Unavailable lab launches
become read-only scenes with no lab evidence action. Runtime continuity integration
belongs to the UI owner. The production certified-lab registry is currently empty.

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

The lesson UI and offline transport are unchanged. No cached object or client
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
