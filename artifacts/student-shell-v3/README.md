# Student dashboard and Help bug-fix evidence

Base: `2bf94c11df127292a1863b75cc338a462204d0a2`. Screens render production components with synthetic API data and a fixture identity. They do not certify production authentication, real student records, or deployment.

The old CSS left-aligned capped dashboard containers after the rail. The dedicated tutor used a fixed viewport-wide `z-50` wrapper, covering navigation. The fix applies one dashboard width/gutter contract within `.pdv2-body`, expands the Labs grid, and places the existing grounded assistant in the Help page's normal flow. Question, citation, context, action, and server authority contracts remain intact.

All five routes have equal left/right whitespace inside the content viewport remaining after the rail:

| Viewport | Left | Right | Content utilization |
| --- | ---: | ---: | ---: |
| 390 | 16px | 16px | 92% |
| 768 | 24px | 24px | 91% |
| 1440 | 32px | 32px | 95% |
| 1920 | 153px | 153px | 82% |

Before at 1920: Today/Learn 40px left versus 282px right; Progress 32px versus 400px. The baseline Labs metrics measure its outer main wrapper; the baseline screenshots additionally show its nested 1152px cap, removed by the fix.

Before/after captures for Today, Learn, Labs, Progress and Help at every viewport are in [before](before) and [after](after). Examples: [Today before](before/today-1920.png), [Today after](after/today-1920.png), [Help before](before/help-1440.png), [Help after](after/help-1440.png), [Labs after](after/labs-1920.png). [Layout measurements](after/results.json) record 20 passing layouts, no horizontal overflow and unobscured active navigation.

[Keyboard and accessibility evidence](after/navigation.json): Today → Help → Learn and Help → Today via Tab/Shift+Tab and Enter at all four widths; Labs/Progress reachable; floating assistant Escape restores launcher focus. Help axe scans at 390/1440 have zero violations; no browser page errors. Run `node e2e/student-shell-v3/run.mjs after` for layouts/captures and flows, or add `--flows-only` for keyboard/accessibility checks.

CSS ownership: `components/student/StudentDashboard.css` governs `.pdv2-shell` dashboards. Focused lesson/lab shells use `.pdv2-focused` and are excluded. Lesson routes, `LessonPlayerV2`, `SceneViews`, and lesson-specific styles are unchanged in this branch.

Validation on the final source: `npm run validate:changed` passed (8 related test files, 189 tests, including TypeScript checking); focused ESLint and standalone TypeScript checks passed; `npm run build` passed with physical worktree-local dependencies and produced `.next/standalone/server.js`. The compiled client includes the accessible Assistant answers region. Existing repository build warnings remain; no standalone packaging error occurred. Build and validation logs remain local because repository rules ignore `.log` files. No deployment or production-data validation was performed.
