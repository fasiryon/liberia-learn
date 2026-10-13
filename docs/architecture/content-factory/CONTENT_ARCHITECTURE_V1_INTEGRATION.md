# Content Architecture V1 Integration

This note clarifies the integrated foundation without modifying the source
audits, readiness decision or foundation document. No new architecture,
production consumer, API, schema or release authority is introduced.

## Integrated sources

- [Product audit](CONTENT_PRODUCT_DELIVERY_AUDIT_V1.md):
  `ed3e2eee2f04d1cb12909b3d7cc0f5390f1649c5`.
- [Engine/governance audit](CONTENT_ENGINE_GOVERNANCE_AUDIT_V1.md) and
  [readiness decision](CONTENT_FACTORY_READINESS_V1.md):
  `008f950899fa06018fe2a5cd9046cd52265e773c`.
- [ContentBundle foundation](CONTENT_BUNDLE_V1_FOUNDATION.md),
  `lib/content-bundle/v1/*` and `__tests__/content-bundle/*`:
  `7f515f68f62302b3a745373d2a8aa5c5abfc24f7`, including its foundation parent
  `247e4b0b`.

Integration base: `f22ccb7bbfb8b7f57ab6ebd3ff7b7ae2f2e445f1`.
Branch: `feat/content-architecture-v1`. All four source documents and foundation
files are preserved unchanged; their relative document links resolve here.

## Hash clarification

ContentBundle `contentHash` is the deterministic hash of the **exact governed
bundle composition**, not merely the instructional text. `releaseId` and
`releaseIdentity` belong to `curriculumAuthority` and are included in the
hashed payload. Rebinding otherwise identical instructional material to a
different governed release may therefore produce a different bundle hash.

This does not include review-event history or derived renderings in the hash.
The existing implementation excludes governance `reviewRefs`, `lifecycleRefs`
and `releaseRefs`, derived `renderings`, and the self hash. Composition
`provenanceRefs` remain included. A release identity reference in the composition
is distinct from release-event history attesting to that composition.
No hashing redesign or behavior change is required.

## Lab-link revision clarification

`LearningExperienceLink` currently lacks the stable revision identity required
by ContentBundle V1's `linkRevision`. Therefore **production ContentBundle lab
bindings remain non-runnable until the lab-link governance model gains stable
revision identity**. An arbitrary revision string that passes structural
validation cannot satisfy this governance requirement.

Stable link revision identity is necessary but not sufficient: exact-version
certification, release, eligibility and access gates still apply. The first
Grade 4 fractions vertical is unaffected because it includes no lab. This
integration does not change lab governance or enable lab delivery.

## Integration validation

- All ContentBundle tests: 1 file, 80 tests passed.
- Repository TypeScript: `tsc --noEmit` passed.
- Changed-file ESLint: foundation and ContentBundle tests passed.
- `npm.cmd run validate:changed -- --base
  f22ccb7bbfb8b7f57ab6ebd3ff7b7ae2f2e445f1`: passed, including route policy
  audit, changed/related tests and TypeScript. No Prisma operation was invoked.
- All five integrated documents' relative links resolve. Four source documents
  match their source Git blobs; foundation code/tests match the supplied
  foundation commit. Diff whitespace checks passed.
- Direct `next build`: exit 0; 387/387 static pages generated. Used existing
  installed dependencies, disabled environment validation/telemetry and a
  nonfunctional localhost database URL; no hosted credentials were copied.
  The npm build wrapper was avoided because it invokes Prisma generation.
  Build warnings included outdated Browserslist data, Sentry/OpenTelemetry
  tracing, unrelated existing lint warnings, missing Redis configuration and
  dynamic-route static probing. Windows `EPERM` prevented copying the shared
  dependency symlink into standalone output: compilation/build completed, but
  the standalone artifact is not deployment-validated.

No APIs, production consumers, schema changes, hosted operations or deployment
were added. No PR was opened.
