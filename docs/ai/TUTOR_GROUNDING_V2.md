# Lesson-aware tutor grounding V2

Base: `14b7c94673030ad09a86829a0791d14199c95955`. Scope: student tutor grounding; no curriculum generator, projection, governance, learner-state or orchestration mutations.

## Root cause and architecture audit

The lesson delivery helper trusted browser lesson text and learner-state hints. The global assistant supplied only grade/subject/path. Hybrid vector/sparse retrieval could rank broad curriculum and assessment payloads above the current lesson. Weak retrieval still invoked generation, and missing citations could be replaced with inferred source IDs.

| Classification | Components and disposition |
| --- | --- |
| REUSE | Existing grounded answer generator, role/session guards, moderation/retry/escalation, budget/rate controls, shared student projection, published ontology release/bindings, provenance snapshot checks, source cards and audit infrastructure. Staff hybrid retrieval remains available. |
| FIX | Student routes resolve canonical context; exact content precedes broad retrieval; weak context refuses generation; citations must name permitted sources. Lesson helper no longer sends authoritative content/mastery fields. |
| EXTEND | One server TutorContextPackage, scene/objective/revision identity contract, deterministic tiers, contextual actions, diagnostics and authorization fixtures. |
| REMOVE | Student lesson-plan action, duplicate global panel on lesson pages, student use of unprojected sparse/vector candidates, fabricated citation substitution. |
| DEFER | Generator/schema/provenance/projection modifications, new offline AI, learner-state decisions, general web search, semantic reranking improvements for staff. |

Both `/api/student/tutor` and student `/api/rag/query` use the same package and answer generator. Practice compatibility delegates to the existing tutor route. No second tutor stack or assessment authority is introduced. Student retrieval is deterministic over authorized projected records; vector similarity is not an authorization decision.

## Canonical contract and source eligibility

Browser sends bounded identity hints: lesson/content/version/revision, scene, experience/version, objective IDs and release ID. Server resolves student membership, enrolled classes, school, canonical grade/subject, scheduled lesson/content, active version, published state and valid provenance revision in a repeatable-read transaction. Mismatched identities fail closed. Context includes action, learner-safe sources, approved related scope and a fingerprint. Browser source IDs, payloads, grade/subject and mastery claims confer no authority.

Tenant, grade, subject, class assignments, audience/visibility, publication/version state, revision consistency and source type are checked before projection. Existing provenance approval and snapshot/hash policy is reused when provenance exists. Legacy published records without provenance remain supported without claiming a release identity. Only the shared student projection feeds tutoring. Assessment-only records, teacher/private records, assessment scenes, hidden responses and secret-bearing legacy text are excluded. Conservative secret-marker rejection complements the shared projection; it is not a new projection system.

Tier 0: selected scene/current lesson. Tier 1: exact canonical objective resources. Tier 2: governed prerequisites/same unit. Tier 3: canonical grade/subject fallback. Tier always precedes ranking score. Support is queried only when exact content is absent. Eligibility-aware support pagination examines at most 100 records and returns at most five sources.

STRONG means tier 0/1, MEDIUM means tier 2, WEAK means broad/uncertain or absent context. Student WEAK never calls the answer model and offers a bounded lesson/teacher clarification response. Student answer caching is disabled so publication/authorization is re-resolved. Failures never substitute unrelated material. Offline UI tells learners the live tutor needs connectivity; no offline model is added.

## Actions, prompts and UI

Explain differently and practice retain the server-pinned identity and original learner question. Native objective selection narrows scene/lesson content. Practice is labeled generated practice, uses new questions/hints, carries no hidden canonical key and writes no mastery/evidence decisions. Prompt separates current content from supporting data, declares retrieved text untrusted, forbids curriculum invention, release claims, teacher override, answer keys, mastery/placement/remediation/retention/next-lesson decisions. Output is moderated and citations are checked.

The lesson helper owns lesson tutoring, avoiding a second floating panel beside the lesson. Sources are collapsed and limited to three for students, with meaningful current/support relationships. Student quick actions explain the current topic, explain differently and generate practice. Student weak-context language does not expose developer grounding jargon.

Legacy Read/Slides/Listen/Discussion resolve stored projected lesson content; parsed slides confer no authority. Scene-based callers can send scene/objective/experience identity through the same contract. At this base the shared projection is legacy; native tests supply the validated projected LessonExperience seam. Curriculum V2's separate branch supplies that seam through its hardened projection. Raw unpublished/native payloads fail closed. No player or shared projection change is included here.

## Verification and review

`__tests__/tutor.grounding-v2.test.ts` supplies deterministic Addition and Subtraction Reasoning / Grade 7 / Math regression fixtures. Exact source wins over unrelated Fractions/Data Representation assessment records; tests also cover objective tiers, secret exclusion, teacher visibility, inactive releases, tenant/class/grade/subject forgery, revision/scene/objective forgery, weak refusal, injection boundaries, invalid citations, model failure, legacy and projected native scenes, follow-up focus, practice and candidate pagination. Existing route tests cover authenticated role, moderation/budget/rate behavior and practice delegation.

Independent read-only reviewers covered retrieval, assessment secrecy, tenant authorization, AI authority, student UX and player compatibility. The follow-up concept-drift P1 was fixed using pinned identity plus question focus and objective-specific native content; reviewer recheck resolved it. Candidate starvation/case handling P2 was fixed with filtered pagination and a row-21 regression. Native projection compatibility was verified against Curriculum V2's shared projection implementation. No unresolved P0/P1 findings remained at review.

No live child account, production database or model response was used as evidence. The named failure is reproduced in deterministic fixtures, not represented as an authenticated production screenshot. Secrets and full child questions are excluded from diagnostics; diagnostics include action, resolved lesson/objective/scene, source IDs/tiers, strength and fallback reason.

## Remaining limitations

Native scene availability depends on the separately owned shared projection landing; the identity contract and fail-closed consumer are ready. Legacy objective statements have no invented canonical IDs. No governed learner-plan/accessibility signals were available to safely add. The bounded 100-candidate scan may return no support beyond that limit (P2 availability limit). Prompt-injection tests establish prompt/data separation, not a guarantee about every possible model output. No production deployment or merge is authorized.
