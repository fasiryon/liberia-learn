# Draft.6 factory contract handoff to T1

Baseline is merged PR #198, `e5d89c34f421f028428cf9e4230ab3d40ff45536`. No T1-owned renderer, route, registry, layout or CSS file was edited. This is a local coordination handoff, not a message sent to an external service. No student access is enabled.

## Geographic representation

Factory output is `curriculum/factory-v4/drafts/4.0.0-draft.6/g7-civics-counties-capitals/`:

- `liberia-county-map.svg`: actual coordinate-derived county polygons and numbered administrative key.
- `liberia-county-outline-task.svg`: the same numbered polygons without the key, for independent identification.
- `academic-review.json`: verified fifteen-pair answer register, source details, objective bindings and acceptable written reasoning.
- `manifest.json`: exact candidate, package and asset hashes. Bind consumption to these identities, never a mutable latest alias.

The input is the pinned geoBoundaries simplified LBR ADM1 dataset from upstream commit `9469f09`, represented year 2021, sourced to UNMIL/OCHA ROWCA. Raw geometry SHA-256 is `f6f4ed18e1e29532a77325f7af84a6dacc4489d94020f2fa2a8feb12a4da9b34`. Source metadata reports CC BY 3.0 IGO. Both SVGs retain attribution, source URI, license URI, modification notice and no endorsement claim. Independent rights release review is pending.

The current `MAP_EXPLORER` enum only supports `LIBERIA_COUNTIES_SCHEMATIC`. Do not silently render that model for draft.6. The factory deliberately uses no schematic map block. T1 must agree a versioned geographic asset contract before changing its registry. Required contract fields are candidate hash, manifest package hash, asset path/hash, geographic source pin, county area ID/number, source attribution, learning purpose, equivalent nonvisual response, feedback timing and offline behavior. Keep capital recall and area identification as separate response signals. Numbers label county areas; they do not locate capital points. No road or capital-point geometry is supplied, and neither route inference nor geographic mastery is authorized.

Required delivery behavior:

1. Supply the supporting map for EXPLORE/INVESTIGATE and the key-free outline for COMPARE. Keep the register available as a separate support source, with clear practice instructions. Allow responsive zoom and print without illegible labels or horizontal page overflow.
2. Add an accessible spatial alternative, with verified relative positions and coastal relationships and keyboard-operable exploration. Generic image alt text or capital-name recall is insufficient. For the existing comparison, the equivalent must convey north-up orientation, Lofa's northern inland location and Maryland's southeastern coastal location without claiming a road route. Do not infer nonvisual geographic mastery until an equivalent independent task and review exist.
3. Match formative feedback to an attempt. Permit Bensonville/Bentol and River Cess/Rivercess name variants. Keep county recognition separate from capital recall. No official scoring or records writes.
4. Cache the approved geographic bytes and equivalent offline text under the exact package identity. The paper response is capture only.
5. Review small screens, keyboard, screen reader, print and offline behavior independently. Re-run source attribution, access and child-safety review. Factory schema validity is insufficient.

## Exact rational input

The factory owns `lib/content-factory/v4/draft6/rational.ts`. `AnswerRule` distinguishes exact equality from an explicitly requested rounding policy. `checkRationalAnswer` returns `EXACT`, `ROUNDED`, `INCORRECT` or `INVALID` with feedback. Cross multiplication uses integers, not an epsilon around a floating-point key.

The exact task accepts equivalent fractions including unreduced forms and exactly equal finite decimals. Examples: `5/6 = 10/12`; `7/8 = 0.875`; neither `0.83` nor `0.833333` equals `5/6`. Inputs permit signed integers, a/b with a positive nonzero denominator, and finite decimals within documented parser bounds: eight integer digits and six decimal digits. Mixed-number notation, exponent notation and ellipses are not accepted input syntax. Explain supported syntax without treating a mathematically valid mixed number written on paper as conceptually wrong.

The explicit seed estimate is a separate response: `5/12 kg` exactly, approximately `0.42 kg` to two decimal places. Round to nearest, with a halfway value away from zero. An `EXACT` response establishes equality; a `ROUNDED` response establishes the requested approximation. T1 must distinguish the two tasks and avoid marking a rounded value as an exact fraction. Preserve both quantities and their relation. This checker is formative only, and cannot write grades or academic records.

Current draft.6 uses supported CHECK, fraction model, number-line and written-response activities. It does not route a fraction string through the decimal-only NUMERIC_RESPONSE key. Typed rational integration remains explicitly pending. Any frontend implementation requires T1 coordination, runtime review and release authorization; this handoff is not that authorization.

## Science diagrams

The current runtime `DATA_PLOT` carries the complete six energy-temperature pairs. `heating-curve.svg` supplies the matching A-F segment labels and full assumptions for review/print. The x axis is net heat added in kJ, not time. Both phase plateaus represent energy transfer while phases coexist. Do not substitute a temperature-only particle animation for this model; phase fractions and evaporation below boiling require a separately validated physical contract.

The SVG has an accessible numeric description, and the packet includes the complete numeric table and response guidance. T1 should verify plot/text parity and keyboard/screen-reader access in the actual player. No home heating procedure is requested.

## Controlled student preview gate

`review/controlled-preview-plan.json` has `enabled: false`, no eligible hashes, no record writes and no replacement of published lessons. Six packages are candidates, and none has exact-version release authorization. Keep internal routes private and unavailable in production. Following academic recommendations, a release authority must authorize each exact package, and rights, access, accessibility and safety checks must pass before an allowlist can contain it. Preserve the existing Assessment Player V2 boundary, tenant controls and production records. A formative preview must not claim official completion, grades or geographic mastery.
