# PR190 focused repair validation

The repair branch starts at PR190 `45d86dc56ce4f9b02f66bae72ff773b701c32d4a`.
Verified main is `a1508ceaf7d89a338de624e9f63c9c4c592ca28c`; PR191 remains
`5650c4be8a9dbbb07cfbdb4d2f8312cf66443885`. No PR191 files were changed.

## Repairs

- J02: require an authorized exact native scene for tutor requests, reject
  protected assessment and original-writing scenes on the server, omit their
  text from lesson grounding, and withhold help in the player and global shell.
  Preserve the scene identity and clear previous scene conversations. Read the
  policy marker when the shell mounts after the player.
- J02 evidence: raw observations remain unscored and unassessed. Without a
  trusted attempt-bound assistance ledger, use conservative `assistanceUsed`
  and an explicit `assistance-unverified` policy marker. This does not certify
  independence or assert that a student actually requested help.
- J04: disable bookmarks for an empty book and filter invalid stored page
  indexes during render, including when pages disappear with Bookmarks open.
- J05: preserve a single authored section heading without duplicating an
  inferred fallback heading.
- J06: derive shelf titles from the already authorized curriculum payload.

Authentication, tenancy, server completion admission, raw response payloads,
canonical learning state and curriculum approval gates were not relaxed.

## Validation

Windows, Node 24.21, local offline dependencies. Database configuration points
to `127.0.0.1:1` with local dummy credentials. No migrations or hosted writes.

| Command | Result |
| --- | --- |
| Targeted tutor/evidence/reader regression suites | Initial 90 passed; final strengthened tutor/evidence 79 and reader 3 passed |
| `npm.cmd run validate:changed` | Passed, including TypeScript and route audit |
| `npm.cmd run validate:changed -- --no-types` | Final pass, 79 changed and 331 related tests; build also typechecks |
| `npm.cmd run lint` | Passed with existing warnings |
| `npm.cmd --prefix os-vault/daemon test` | 4 passed, 2 Windows symlink skips |
| `npx.cmd prisma generate` | Passed locally, no migration |
| `npx.cmd vitest run` | Fresh local installation: 769 files / 7,501 tests passed; 2 files / 8 tests skipped |
| `npm.cmd run build` | Passed; 391 static pages; standalone packaging succeeded |
| Renderer chunk check through tsx | Passed |
| `node scripts/joint-repairs/run.mjs` | Passed at 390, 768, 1440, 1920px; keyboard and strengthened empty/changed-book, protected-help and late-mount cases; zero page errors and POSTs |
| `node scripts/joint-repairs/pwa.mjs` | Exact standalone build manifest verified; boundary probes passed; all 14 PWA cases passed |
| `node e2e/product-design-v2/run.mjs` | All Today, Learn, Classes, Labs and lesson groups passed; zero serious/critical axe issues |

Build ID: `hxd5v75Nd5Jp4rQt3LcVi`. PWA checks used locally signed synthetic
identity, not an enrolled production student or live curriculum release.
Component browser probes use a synthetic presentation-only native lesson.

The first shared-junction build logged standalone symlink EPERM despite exit 0;
it was rejected as packaging evidence. Installing real local dependencies and
repeating the entire suite/build resolved it without lockfile or source changes.
Cold fixture runs timed out before their first page. Preparing Vite's existing
dependency cache, then rerunning the unchanged full entry passed every group.
No assertion, safety check or timeout was relaxed. Initial and final logs remain
under `artifacts/joint-repairs`; regenerated baseline images were archived there
before restoring only the task-generated tracked artifact changes.

## Separate work and remaining decisions

Slides V2 `0360045006a544539277315add886aa6fb9f6192` passed the separate real
Civics six-size regression, including 307 presentation pages, exact text/order,
keyboard, clipping and accessibility checks. Content ID
`hero-civics-g7-democracy-and-representation-in-liberia`, approved revision
`cmss94h3z03bzvo54hj7c7z8t`, captured body SHA256
`62564d43e7e952124d097f8e7a7499e2344efc53333e8e67d21f724083707c69`.
This is a read-only captured lesson fixture. Slides V2 remains separate;
recommend it after repaired PR190 and before the joint student release, with a
final stacked regression. PR190's existing fullscreen defect is still open.

The separate permanent integration CI proposal is
`6eb9b44de4453630b63a686805f0edcb0caded2c`, based on verified main. It adds
merge-group coverage, full-history checkout and deterministic curriculum checks
while preserving existing gates. Local YAML and changed-file checks passed.
Repository owners still need to adopt it and require the check on the merge
result. No hosted CI execution or branch-protection change is claimed.

Next, commit these focused repairs and integrate their exact head with PR191
in the isolated integration branch. Run the authoritative freshness check and
read-only generated-file comparison before deciding which provenance requires
regeneration. This report is not final joint readiness certification.

The repair author is an AI agent and is not an independent approver of its own
changes. No human curriculum approval, educational efficacy or actual student
learning is established by these engineering results. No merge, push,
deployment, publication, production data mutation or scoring activation occurred.
