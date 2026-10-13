# ContentBundle Teacher Preview V1 (Wave 2A)

Status: product surface over a fixture resolver. It does not resolve governed bundles, publish,
release, assign or deploy anything. Base: `main` at `f28f7107` (PR #184, ContentBundle V1
foundation).

## What it is

A read-only teacher page that renders one resolved ContentBundle V1 and answers two questions:

1. What does this bundle contain, and what is its governance state? (Teacher overview)
2. What will the student actually receive? (Student view)

Route: `/teacher/content-bundles/[bundleId]/preview`, with optional query parameters `version`
(exact bundle version), `view=student` and `item=<itemId>`. Access is limited to the `/teacher`
middleware roles (TEACHER, ADMIN), and the page re-checks with `requireRole("TEACHER", "ADMIN")`.
The route has no write path, no API calls and no mutation controls.

## Intended teacher workflow

1. Open the preview from a bundle link. The header shows the bundle title, grade, subject,
   version and status chips: release state as reported by the resolver, and "Test fixture" when
   the source is not authoritative.
2. Use the left sequence list (unit → ordered members, with Optional markers) or Bundle overview
   to inspect the objectives, textbook/workbook/teacher-guide/assessment-book availability,
   resources with their audience, toolkit bindings, learner support, the offline package and the
   student package pins.
3. Select a member to see its kind, id, version, objective bindings, sequence position,
   requirement and prerequisite/unlock links (which navigate). Activities show type, duration,
   collaboration, scaffolding, evidence, student instructions and teacher instructions.
   Assessments show purpose, definition identity and version, question count, order policy and
   the secured answer-key/scoring-guide references. Labs show governed link, lab identity,
   certification state and whether they can run.
4. The right panel shows item identity, objectives, the tools that apply to the item (with the
   documented rule: an item can narrow a whole-bundle tool, and a prohibition always wins), and
   governance/release references.
5. Switch to **Student view** to see the learner-safe rendering of the same item. The right
   panel then lists only counts of what is withheld.

Keyboard: skip link → mode toggle (native `aria-pressed` buttons) → sequence list (native
buttons; Arrow Up/Down, Home and End move focus, Enter/Space select). Selection is announced
politely. On stacked phone layouts, the panel is scrolled into view after selection.
Layouts: stacked under 768px, two columns (sequence + content, with details below) from 768px,
three columns from 1024px. Product Design V2 tokens, scoped as `.cbp-*` in `app/globals.css`.

## Teacher vs student boundary

`lib/content-bundle/preview/viewModel.ts` builds two separate display models:

- `TeacherPreviewModel` comes from the full sealed bundle plus resolver facts.
- `StudentPreviewModel` comes **only** from `projectLearnerBundle` output (the merged allow-list
  projection) plus one boolean per lab: whether the student can open it. It never sees the full
  bundle.

So Student view cannot render teacher instructions, TEACHER/SYSTEM resources (teacher notes,
answer keys), assessment item lists, definitions or secured references, rubric scoring guides,
PROHIBITED tool bindings, internal tool configuration, teacher-only renderings or assets, or
governance references. Tests check this on the model's serialized JSON and on every rendered
student page, both in jsdom and in a real browser.

Student view shows bundle-wide REQUIRED/OPTIONAL tools only, as the projection does.
Prohibitions are enforced by the server and are not advertised to learners. Teachers see this as
a "Tool prohibitions (enforced by the server, not shown)" count.

## Resolver interface expected from Wave 2B

`lib/content-bundle/preview/resolver.ts`:

```ts
interface ContentBundlePreviewResolver {
  resolveForTeacherPreview(request: { bundleId; bundleVersion: string | null; viewer: { userId; role; schoolId } }):
    Promise<RESOLVED | NOT_FOUND | FORBIDDEN | INVALID | RESOLVER_UNAVAILABLE>;
}
```

A `RESOLVED` result must carry:

- `bundle` + `contentHash`: validated and sealed (`sealContentBundle`).
- `learnerBundle`: `projectLearnerBundle(bundle, contentHash)` for the same seal.
- `source`: `{ kind: "GOVERNED_STORE" | "FIXTURE", label, authoritative }`.
- `release`: `NOT_EVALUATED | UNRELEASED | RELEASED(releaseRef)` for the exact
  (bundleId, version, contentHash), from release governance.
- `labReadiness[itemId]`: `CERTIFIED_RUNNABLE | NOT_CERTIFIED | LINK_REVISION_MISSING |
  NOT_EVALUATED` plus a reason, from the lab registry and link governance. Only
  `CERTIFIED_RUNNABLE` is shown as runnable.
- `toolkit`: the pinned mapping it checked against, whether that mapping is reviewed, runtime
  tool names and `checkToolkitMapping` issues.

Wave 2B owns viewer authorization beyond role (school/class/tenant scope), the governed bundle
store, version selection when `bundleVersion` is null, and these authority facts. The UI computes
none of them.

The fixture adapter (`fixtureResolver.ts`) serves only registered fixtures. It reports release
as NOT_EVALUATED, every lab as NOT_EVALUATED (therefore not runnable), and the mapping as
unreviewed. `server.ts` uses it only when `NODE_ENV !== "production"`. In production the route
renders "Preview not available yet". This is not a feature flag or a release decision.

## Fixture

The primary fixture is the merged synthetic `fixture.bundle.g4-math-fractions@1.0.0-fixture`
(`lib/content-bundle/v1/fixtures/grade4FractionsFixture.ts`), unchanged. No new curriculum was
created. It has no lab, and the preview says "0 labs". To exercise lab states, tests and the
browser harness derive a test-only variant in place, adding one GOVERNED_LINK binding with the
same shape the foundation tests use.

## Evidence

- `__tests__/content-bundle/teacherPreview.test.tsx`: resolver seam, teacher overview, tool
  bindings, offline pins, sequence and keyboard navigation, activities by type, assessment
  secrecy, lab readiness states, student-view isolation, route states and no write path.
- `node e2e/content-bundle-teacher-preview/run.mjs` (Vite + Playwright): layout at
  320/390/768/1024/1280/1440/1920 in both modes with no horizontal overflow, real keyboard flow
  with visible focus, eight student pages free of teacher-only strings, lab non-runnable in both
  modes, and controls at least 44px tall at 320px. Output goes to
  `artifacts/content-bundle-teacher-preview/`.

## Known limitations

- No governed resolver, persistence or bundle discovery list. The preview is reached by URL.
- Objectives display by id. The bundle carries no objective text, and resolving it belongs to the
  curriculum authority.
- Labs have no title in the contract, so they are named by lab id.
- Assessment question content and answer keys are references only. Nothing is fetched.
- Teacher/Student mode and selection are not written back to the URL.
- The fixture's tool mapping is unreviewed, and the page says so.
- Authenticated end-to-end checks through Next and middleware were not run. Browser evidence uses
  the component harness. Route authorization is unit-tested with a mocked `requireRole`.
