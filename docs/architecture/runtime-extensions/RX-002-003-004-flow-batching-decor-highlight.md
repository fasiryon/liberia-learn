# RX-002 / RX-003 / RX-004: flow batching, decor detail, non-emissive highlight

- **Filed by:** LAB-BUILDER on 2026-09-28, from the `lab-asset-director` spec for `mount-coffee-hydropower` (`docs/labs/mount-coffee-hydropower/design/04-ASSET_SPEC.md`).
- **Status:** PROPOSED.
- **Runtime:** shared runtime only; nothing is lab-local.

## Why

The locked LOW budget is 40 draw calls, sized for TARGET_LOW_DEVICE (Tecno Spark Go 2024). Today each flow costs a line-strip draw and a particle draw, plus a trace overlay. The smallest honest hydro diorama is about 34 items with 10 process flows, which comes to about 55 draws at LOW. Neither lowering fidelity nor raising the locked budget is acceptable, so the runtime has to change.

## RX-002: batched flow rendering

- **What.** Draw all flow paths as one `gl.LINES` call, with each strip expanded to segment pairs. Draw all flow particles as one `gl.POINTS` call. Draw the trace-node overlay as one call. Each call uses a per-vertex colour attribute. The shader gains an `attribute vec3 vcolor` and a `useVertexColor` uniform; solid meshes keep the uniform colour.
- **Draw calls.** Flows cost at most 3 draws in total, whatever the count. The budget formula in `measureLabBudget` becomes `items + (flows ? 3 : 0) + (markers ? 1 : 0)`, which removes the old 3 per flow.
- **Per profile.** Identical at every WebGL profile. FALLBACK_2D (SVG) is unchanged.
- **Shared inactive-flow token.** `INACTIVE_FLOW_COLOR = #779ab2` is consumed by both WebGL and FALLBACK_2D. The original `#94a3b8` proposal passed contrast at full opacity but measured only ΔE00 20.9 from the required fuchsia highlight, below the 25 separation gate. `#779ab2` measures 3.54:1 against the lightest stage-background sample and ΔE00 25.9 from `#f0abfc`. It is opaque in both renderers; if a future renderer or material applies alpha, post-blend contrast must remain at least 3:1.
- **Inactive flow styling.** Inactive paths are dashed in both renderers: WebGL alternates segment pairs and 2D uses `strokeDasharray`. Their particles are omitted. A renderer parity test checks both the shared colour and the dashed state.
- **Palette separation.** A colour gate checks every active-flow palette entry against the inactive-flow token at CIEDE2000 ΔE00 ≥ 20. It explicitly includes the pale spillway blue-white `#cffafe`; tests use the final composited colour, not only source hex values.
- **Particle size.** Particles share one point size per call. Flows keep the per-profile size they have today (6 at LOW, 9 otherwise).
- **Steady-state storage.** Flow batches use reusable typed-array capacity and WebGL buffer storage. Capacity grows only when a larger render list requires it, old GPU storage is replaced at that growth boundary, and buffers are released on context teardown. No per-frame typed-array allocation or GPU-buffer recreation is allowed in the steady-state draw path.
- **Evidence and offline.** No impact on either.
- **Tests.**
  - The budget formula changes, so the baseline is regenerated. Measured draw calls may only go down.
  - Instructional equivalence is unchanged.
  - A pure `batchFlowGeometry(list, time, reducedMotion)` helper returns vertex and colour arrays. It is unit-tested for counts and colours, and for the inactive colour.
  - WebGL/2D share the inactive token and dash semantics; the final-colour contrast and active-palette ΔE00 gates pass, including `#cffafe`.
  - The batch writer reuses preallocated typed-array capacity and GPU buffers across steady-state frames; tests cover reuse and growth without replacing storage when capacity is sufficient.

## RX-003: decor detail

- **What.** A component may declare `detail: "decor"`. `buildRenderList` omits decor when `budget.meshDetail === "low"`. HIGH, STANDARD and FALLBACK_2D keep it.
- **Authoring gate.** Decor must be purely decorative, so the gate rejects decor that is:
  - selectable, or named by any flow node, check, guided highlight, cutaway, exploded view, slot, assembly or motion group;
  - `internal`;
  - state-driven through any render property, including emissive, colour, alpha, pose or `componentStates`;
  - named by a prompt, explanation or camera focus, or carrying text, a symbol, scale or place identity.
  The hospital H sign, the ≈30 km line break, the river bend and transmission-tower silhouettes are instructional anchors and must never be decor.
- **Equivalence.** `instructionalView` is unchanged, because decor is never actionable.
- **Tests.**
  - The gate rejects each forbidden reference.
  - Decor is present at HIGH, STANDARD and FALLBACK_2D and absent at LOW.
  - A HIGH state sweep across every review scenario asserts decor render properties remain identical.
  - In 2D, decor is drawn first, has `pointer-events: none`, is excluded from picking, and is tested not to overlap trace nodes or labels.
  - `instructionalView` is equal across all four profiles.

## RX-004: non-emissive highlight

- **What.** In WebGL, a highlight currently adds a warm emissive pulse (0.04–0.20) plus 0.12 to the base colour. On an unlit building this reads as "dimly lit", which is misconception 7 (on overload, everyone just gets dimmer lights). The change:
  - Both renderers use the shared `HIGHLIGHT_COLOR = #f0abfc` token instead of cyan `#67e8f9`.
  - A palette gate requires the token to be CIEDE2000 ΔE00 ≥ 25 from every active flow colour, the emissive-glow colour and the inactive-flow grey.
  - WebGL carries the highlight mainly as a shader rim/Fresnel term with about a 20% base-colour mix. For every material, the final highlighted colour must remain ΔE00 ≥ 15 from its unhighlighted base.
  - Highlighted items have an explicit alpha floor, preserving their visibility when the emissive alpha boost is removed.
  - At HIGH only, and only when `budget.pulseHighlights && !reducedMotion`, the rim/mix pulses. Otherwise the highlight is steady.
  - Highlights never contribute emissive. Only the simulation's `intensity` produces emissive.
  - This matches the 2D fallback's cyan highlight stroke.
- **Cost.** None.
- **Tests.**
  - A pure `highlightColor(base, highlighted, pulse)` helper.
  - Emissive depends only on the simulation's `intensity`, never on the highlight.
  - Palette-separation and per-material highlight-difference gates, plus an alpha-floor assertion.
  - Before/after capture pairs for the simple-circuit fixture and a solids fixture, recorded for visual review.

## Design review amendments (2026-09-28)

The independent design review returned **APPROVE_WITH_CHANGES** for RX-002, RX-003 and RX-004 (0 P0, 7 P1, 5 P2). The requirements above record its required changes before implementation. The design review ran before `04-ASSET_SPEC.md` existed; the additional asset-specific exclusions below are now mandatory for RX-003: the hospital H sign, ≈30 km break, river bend and tower silhouettes remain instructional landmarks. No extension is considered implemented until the runtime code and tests enforce these requirements.

**Implementation status remains PROPOSED.** The performance review is complete with changes required. Its findings and evidence are recorded below; no shared runtime implementation has started.

**`lab-performance-reviewer` verdict: APPROVE_WITH_CHANGES** (P0 0, P1 4, P2 0). The four P1s were: reuse flow-batch storage across frames; share and gate inactive-flow contrast/palette/dash semantics across WebGL and 2D; keep decor out of instructional and interactive paths with a HIGH scenario state sweep plus 2D ordering/picking/overlap rules; and preserve highlight visibility/parity with colour separation, rim treatment, alpha floor, pulse gating and captures. The latter three are specified above. The first is specified under RX-002 steady-state storage and requires implementation tests. The review found no physical-device or renderer certification evidence.

**Per-profile review state:** HIGH, STANDARD, LOW and FALLBACK_2D remain NOT MEASURED for implementation performance. RX-002 targets the locked LOW budget; no counts or frame rates are claimed. **OFFLINE PACKAGE:** NOT MEASURED until a lab definition and manifest exist. **NOT MEASURED:** GPU run, real device, offline manifest, draw-count baseline, frame timing, heap, memory, load time and battery impact.
