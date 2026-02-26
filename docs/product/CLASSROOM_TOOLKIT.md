# Classroom Toolkit

## Tool Inventory

| id | name | grades | subjects | lesson types |
|---|---|---|---|---|
| basic-calculator | Basic Calculator | 1-3, 4-6 | math, science | assessment, practice |
| scientific-calculator | Scientific Calculator | 7-9, 10-12 | math, science, engineering | assessment, practice |
| fraction-visualizer | Fraction Visualizer | 1-3, 4-6 | math | lesson, practice |
| number-line | Number Line | 1-3, 4-6 | math | lesson, practice, assessment |
| digital-ruler | Digital Ruler | 4-6, 7-9, 10-12 | math, science | lesson, practice, assessment |
| protractor | Protractor | 7-9, 10-12 | math | lesson, practice, assessment |
| multiplication-table | Multiplication Table | 1-3, 4-6 | math | lesson, practice |
| periodic-table | Periodic Table | 7-9, 10-12 | science | lesson, practice, assessment |
| unit-converter | Unit Converter | 7-9, 10-12 | math, science | lesson, practice, assessment |
| coordinate-grid | Coordinate Grid | 7-9, 10-12 | math | lesson, practice, assessment |
| timer | Timer | all | all | assessment |
| dictionary | Dictionary | all | english | lesson, practice |

## Context Detection

`useToolkitContext()` resolves context in this order:
1. Toolkit provider context value.
2. URL query params (`subject`, `gradeBand`, `lessonType`, `strandKey`).
3. Dynamic route params fallback for `subject`, `gradeBand`, and `lessonType`.

If a complete valid context cannot be built, the hook returns `null`.

## Offline Guarantee

- Toolkit tools do not call external APIs.
- Tool datasets are bundled in component files.
- All interactions are client-local and stateful in memory only.

## Accessibility Standards

- Every interactive control has an `aria-label`.
- All tools provide a visible close/dismiss action.
- Draggable panels support keyboard `Escape` and focus trap.
- Toolbar actions are keyboard reachable and actionable with `Enter/Space`.

## Feature Flag Rollout Guide

Server flags in `lib/serverFlags.ts`:

- `ENABLE_CLASSROOM_TOOLKIT`
- `ENABLE_TOOLKIT_CALCULATOR`
- `ENABLE_TOOLKIT_SCIENCE_TOOLS`
- `ENABLE_TOOLKIT_GEO_TOOLS`
- `ENABLE_TOOLKIT_TIMER`

Recommended rollout sequence:

1. Enable `ENABLE_CLASSROOM_TOOLKIT=true` in staging only.
2. Enable one category flag at a time and validate UX.
3. Verify telemetry and audit dashboards for non-PII payloads.
4. Promote category flags to production progressively.

## Add New Tool (Registry Pattern)

1. Add a tool component under `components/toolkit/tools/`.
2. Register metadata and context matching in `lib/toolkit/toolRegistry.ts`.
3. Add the component mapping in `components/toolkit/toolComponents.tsx`.
4. Add telemetry tests and registry tests for the new context rules.
5. Keep tool behavior offline-only and add keyboard accessibility labels.
