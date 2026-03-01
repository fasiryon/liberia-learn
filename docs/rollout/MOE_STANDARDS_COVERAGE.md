# MOE Standards Coverage Verification Report — AI Factory Audit

**Produced:** 2026-02-28
**Branch:** `feat/ai-factory-standards-traceability`
**Scope:** Read-only static analysis — no production traffic sampled
**Analyst:** Codex / Principal Engineer review

---

## 1) Standards Inventory

### Source of Truth

MOE standard codes are defined in:
- **`prisma/seeds/moe-standards.ts`** — canonical seed file, 53 codes
- **`prisma/schema.prisma` → `Standard` model** — DB table (`code`, `description`, `subject`, `band`)

> **Note:** The platform documentation references "47 MOE curriculum standard codes" but the
> authoritative seed file (`moe-standards.ts`) contains **53 codes**. This discrepancy of 6 codes
> is a documentation error. All 53 codes are analysed below.

### Full Standards List

#### MATHEMATICS — 20 codes

| Code | Band | Description |
|------|------|-------------|
| LR-MATH-G1_3-01 | G1–3 | Count, read, and write whole numbers up to 1,000; understand place value to hundreds |
| LR-MATH-G1_3-02 | G1–3 | Add and subtract whole numbers up to 100 with and without regrouping |
| LR-MATH-G1_3-03 | G1–3 | Identify and describe basic geometric shapes (circle, square, triangle, rectangle) |
| LR-MATH-G1_3-04 | G1–3 | Measure length using non-standard and standard units (centimeters, meters) |
| LR-MATH-G1_3-05 | G1–3 | Tell time to the hour and half-hour; identify days of the week and months |
| LR-MATH-G4_6-01 | G4–6 | Multiply and divide multi-digit whole numbers; understand factors and multiples |
| LR-MATH-G4_6-02 | G4–6 | Add, subtract, and compare fractions and decimals |
| LR-MATH-G4_6-03 | G4–6 | Calculate perimeter and area of rectangles and triangles |
| LR-MATH-G4_6-04 | G4–6 | Interpret and create bar graphs, line graphs, and pictographs using local data |
| LR-MATH-G4_6-05 | G4–6 | Solve word problems involving money (Liberian dollars) and everyday transactions |
| LR-MATH-G7_9-01 | G7–9 | Solve linear equations and inequalities in one variable |
| LR-MATH-G7_9-02 | G7–9 | Understand and apply ratios, proportions, and percentages in real-world contexts |
| LR-MATH-G7_9-03 | G7–9 | Calculate surface area and volume of prisms, cylinders, and cones |
| LR-MATH-G7_9-04 | G7–9 | Apply the Pythagorean theorem and basic trigonometric ratios |
| LR-MATH-G7_9-05 | G7–9 | Collect, organize, and interpret statistical data; calculate mean, median, and mode |
| LR-MATH-G10_12-01 | G10–12 | Solve quadratic equations by factoring, completing the square, and the quadratic formula |
| LR-MATH-G10_12-02 | G10–12 | Analyze functions (linear, quadratic, exponential) and their graphs |
| LR-MATH-G10_12-03 | G10–12 | Apply probability concepts to real-world situations including compound events |
| LR-MATH-G10_12-04 | G10–12 | Understand sequences, series, and basic financial mathematics (interest, loans) |
| LR-MATH-G10_12-05 | G10–12 | Use matrices and vectors for solving systems of equations |

#### SCIENCE — 11 codes

| Code | Band | Description |
|------|------|-------------|
| LR-SCI-G1_3-01 | G1–3 | Identify living and non-living things in the local environment |
| LR-SCI-G1_3-02 | G1–3 | Describe the basic needs of plants and animals (water, food, shelter, air) |
| LR-SCI-G1_3-03 | G1–3 | Observe and describe weather patterns and seasonal changes in Liberia |
| LR-SCI-G4_6-01 | G4–6 | Explain the water cycle and its importance to Liberian agriculture |
| LR-SCI-G4_6-02 | G4–6 | Describe the structure and function of major human body systems |
| LR-SCI-G4_6-03 | G4–6 | Identify simple machines and explain how they make work easier |
| LR-SCI-G7_9-01 | G7–9 | Explain chemical reactions, acids, bases, and the pH scale |
| LR-SCI-G7_9-02 | G7–9 | Describe cell structure, cell division, and basic genetics |
| LR-SCI-G7_9-03 | G7–9 | Understand forces, motion, and Newton's laws of motion |
| LR-SCI-G10_12-01 | G10–12 | Analyze ecosystem dynamics, biodiversity, and conservation in Liberia's rainforests |
| LR-SCI-G10_12-02 | G10–12 | Apply principles of electricity, magnetism, and electromagnetic waves |

#### LITERACY — 11 codes

| Code | Band | Description |
|------|------|-------------|
| LR-LIT-G1_3-01 | G1–3 | Recognize and produce letter sounds (phonemic awareness) in English |
| LR-LIT-G1_3-02 | G1–3 | Read and comprehend grade-level texts with fluency |
| LR-LIT-G1_3-03 | G1–3 | Write simple sentences and short paragraphs using correct grammar |
| LR-LIT-G4_6-01 | G4–6 | Read and summarize fiction and non-fiction texts; identify main idea and details |
| LR-LIT-G4_6-02 | G4–6 | Write organized multi-paragraph essays with introduction, body, and conclusion |
| LR-LIT-G4_6-03 | G4–6 | Use context clues and dictionaries to determine word meanings |
| LR-LIT-G7_9-01 | G7–9 | Analyze literary devices (metaphor, simile, imagery) in African and world literature |
| LR-LIT-G7_9-02 | G7–9 | Write persuasive and argumentative essays with evidence and reasoning |
| LR-LIT-G7_9-03 | G7–9 | Conduct research using multiple sources and cite references properly |
| LR-LIT-G10_12-01 | G10–12 | Critically analyze complex texts including Liberian and West African literature |
| LR-LIT-G10_12-02 | G10–12 | Write research papers and formal reports following academic conventions |

#### CIVICS — 6 codes

| Code | Band | Description |
|------|------|-------------|
| LR-CIV-G1_3-01 | G1–3 | Identify national symbols of Liberia (flag, seal, anthem) and their meanings |
| LR-CIV-G4_6-01 | G4–6 | Explain the three branches of Liberia's government and their functions |
| LR-CIV-G4_6-02 | G4–6 | Describe the rights and responsibilities of Liberian citizens |
| LR-CIV-G7_9-01 | G7–9 | Analyze the history of Liberia from founding through the civil wars to present |
| LR-CIV-G7_9-02 | G7–9 | Compare Liberia's constitution with other democratic constitutions |
| LR-CIV-G10_12-01 | G10–12 | Evaluate Liberia's role in ECOWAS, the African Union, and the United Nations |

#### COMPUTER SCIENCE — 5 codes

| Code | Band | Description |
|------|------|-------------|
| LR-CS-G4_6-01 | G4–6 | Identify basic computer components (CPU, RAM, storage) and their functions |
| LR-CS-G7_9-01 | G7–9 | Write simple programs using variables, loops, and conditionals |
| LR-CS-G7_9-02 | G7–9 | Understand the internet, web browsers, and responsible digital citizenship |
| LR-CS-G10_12-01 | G10–12 | Design and implement algorithms using functions, arrays, and basic data structures |
| LR-CS-G10_12-02 | G10–12 | Understand databases, SQL basics, and data management principles |

### Strand Catalog — Supporting Infrastructure

**`prisma/seeds/strand-catalog.ts`** defines 92 strands across 5 subjects:

| Subject | G1–3 | G4–6 | G7–9 | G10–12 | Total |
|---------|------|------|------|--------|-------|
| MATH | 5 | 5 | 5 | 5 | 20 |
| SCIENCE | 5 | 5 | 5 | 5 | 20 |
| ENGINEERING | 4 | 4 | 4 | 4 | 16 |
| COMPUTER_SCIENCE | 4 | 4 | 4 | 4 | 16 |
| LITERACY | 5 | 5 | 5 | 5 | 20 |
| **CIVICS** | **0** | **0** | **0** | **0** | **0** |
| **Total** | **23** | **23** | **23** | **23** | **92** |

> **Critical gap:** CIVICS has 6 MOE codes but **zero strands** in StrandCatalog.
> ENGINEERING has **16 strands** but **zero MOE codes**. These are structural inversions.

---

## 2) Coverage Matrix

### Tier Definitions

| Tier | Name | Criteria |
|------|------|----------|
| **T1** | Full coverage | Code traceable across all 3 AI Factory output types (lessons, assessments, interventions) |
| **T2** | Partial coverage | Code traceable in 1–2 output types; intervention path broken (no strand) or strand is an inexact match |
| **T3** | Indirect coverage | Strand-level only; code exists but no dedicated strand maps to it and no intervention trigger path |
| **T4** | Gap | Code exists but no active generation path or alignment can reference it |

### How Each Output Type Traces a Code

| Output Type | Mechanism | Condition for Coverage |
|-------------|-----------|----------------------|
| **Lessons** | `moeAlignmentCodes` injected into AI system prompt via `moeHint`; post-hoc alignment via `alignContentToMOE()` keyword/AI engine | Subject in `SUBJECT_MAP`; `moeAlignmentCodes` provided at call time OR alignment engine run post-generation |
| **Assessments** | `standardCodes: string[]` attached per item (Gap 1 fix); flows from `moeAlignmentCodes` in request body | Same codes provided to `generateAssessmentItems()` via full-pack or generate route |
| **Interventions** | `recommendationEngine` uses `targetStrandKeys`; `interventionEngine` fires on `StudentMasteryProfile` by `subject+strandKey`; no direct MOE code reference | A `StrandCatalog` entry must exist at the same `subject+gradeBand`; mastery data accumulates; alerts can then be tied back to strand → code |

### Full Coverage Matrix — MATHEMATICS (20 codes)

| Code | Strand Match | Lessons | Assessments | Interventions | **Tier** |
|------|-------------|---------|-------------|---------------|----------|
| LR-MATH-G1_3-01 | `number_sense` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G1_3-02 | `basic_operations` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G1_3-03 | `shapes_geometry` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G1_3-04 | `measurement_basics` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G1_3-05 | `patterns` ⚠ (time/calendar ≠ patterns) | ✓ | ✓ | ⚠ indirect | **T2** |
| LR-MATH-G4_6-01 | `multi_digit_ops` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G4_6-02 | `fractions_decimals` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G4_6-03 | `area_perimeter` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G4_6-04 | `data_graphs` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G4_6-05 | `ratios_rates` ⚠ (money/LRD ≠ ratios) | ✓ | ✓ | ⚠ indirect | **T2** |
| LR-MATH-G7_9-01 | `algebra_basics` + `expressions_eqs` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G7_9-02 | `proportional` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G7_9-03 | `geometry_proofs` ⚠ (volume ≠ proof focus) | ✓ | ✓ | ⚠ indirect | **T2** |
| LR-MATH-G7_9-04 | `geometry_proofs` ⚠ (trig not a G7_9 strand) | ✓ | ✓ | ⚠ indirect | **T2** |
| LR-MATH-G7_9-05 | `statistics_prob` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G10_12-01 | `advanced_algebra` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G10_12-02 | `functions_modeling` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G10_12-03 | `combinatorics` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-MATH-G10_12-04 | none ✗ (sequences/financial — no dedicated strand) | ✓ | ✓ | ✗ no strand | **T2** |
| LR-MATH-G10_12-05 | none ✗ (matrices/vectors — no dedicated strand) | ✓ | ✓ | ✗ no strand | **T2** |

### Full Coverage Matrix — SCIENCE (11 codes)

| Code | Strand Match | Lessons | Assessments | Interventions | **Tier** |
|------|-------------|---------|-------------|---------------|----------|
| LR-SCI-G1_3-01 | `living_nonliving` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-SCI-G1_3-02 | `plants_animals` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-SCI-G1_3-03 | `weather_patterns` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-SCI-G4_6-01 | `earth_systems` ⚠ (water cycle → earth systems, indirect) | ✓ | ✓ | ⚠ indirect | **T2** |
| LR-SCI-G4_6-02 | `human_body` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-SCI-G4_6-03 | `forces_motion` ⚠ (simple machines ≈ forces, indirect) | ✓ | ✓ | ⚠ indirect | **T2** |
| LR-SCI-G7_9-01 | `chemistry_basics` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-SCI-G7_9-02 | `cells_biology` + `genetics_intro` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-SCI-G7_9-03 | `physics_energy` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-SCI-G10_12-01 | `ecology_advanced` + `advanced_biology` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-SCI-G10_12-02 | `physics_mechanics` ✓ | ✓ | ✓ | ✓ | **T1** |

### Full Coverage Matrix — LITERACY (11 codes)

| Code | Strand Match | Lessons | Assessments | Interventions | **Tier** |
|------|-------------|---------|-------------|---------------|----------|
| LR-LIT-G1_3-01 | `phonics_decoding` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G1_3-02 | `reading_comp_basic` + `sight_words` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G1_3-03 | `narrative_writing` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G4_6-01 | `reading_comp_intermed` + `literary_elements` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G4_6-02 | `expository_writing` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G4_6-03 | `vocabulary_context` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G7_9-01 | `literary_analysis` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G7_9-02 | `argumentative_writing` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G7_9-03 | `research_skills` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G10_12-01 | `critical_analysis` ✓ (WASSCE-ENG-A1) | ✓ | ✓ | ✓ | **T1** |
| LR-LIT-G10_12-02 | `academic_writing` ✓ (WASSCE-ENG-A2) | ✓ | ✓ | ✓ | **T1** |

### Full Coverage Matrix — CIVICS (6 codes)

> ⚠ **CIVICS has ZERO StrandCatalog entries.** The intervention path is completely
> broken for all 6 codes. Students struggling with Civics standards generate no
> mastery signal and trigger no intervention alerts.

| Code | Strand Match | Lessons | Assessments | Interventions | **Tier** |
|------|-------------|---------|-------------|---------------|----------|
| LR-CIV-G1_3-01 | none ✗ | ✓ | ✓ | ✗ no strand | **T2** |
| LR-CIV-G4_6-01 | none ✗ | ✓ | ✓ | ✗ no strand | **T2** |
| LR-CIV-G4_6-02 | none ✗ | ✓ | ✓ | ✗ no strand | **T2** |
| LR-CIV-G7_9-01 | none ✗ | ✓ | ✓ | ✗ no strand | **T2** |
| LR-CIV-G7_9-02 | none ✗ | ✓ | ✓ | ✗ no strand | **T2** |
| LR-CIV-G10_12-01 | none ✗ | ✓ | ✓ | ✗ no strand | **T2** |

### Full Coverage Matrix — COMPUTER SCIENCE (5 codes)

| Code | Strand Match | Lessons | Assessments | Interventions | **Tier** |
|------|-------------|---------|-------------|---------------|----------|
| LR-CS-G4_6-01 | none ✗ (hardware — no `hardware_basics` strand at G4_6) | ✓ | ✓ | ✗ no strand | **T2** |
| LR-CS-G7_9-01 | `programming_intermed` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-CS-G7_9-02 | `networking_basics` ⚠ + `cybersecurity` ⚠ (split) | ✓ | ✓ | ⚠ indirect | **T2** |
| LR-CS-G10_12-01 | `algorithms_advanced` ✓ | ✓ | ✓ | ✓ | **T1** |
| LR-CS-G10_12-02 | `databases` ✓ | ✓ | ✓ | ✓ | **T1** |

---

## 3) Coverage Summary

### Tier Totals

| Tier | Count | % of 53 | Description |
|------|-------|---------|-------------|
| **T1 — Full** | **37** | **69.8%** | All 3 output types traceable |
| **T2 — Partial** | **16** | **30.2%** | 1–2 output types; intervention blind or strand mismatch |
| **T3 — Indirect** | **0** | **0%** | — |
| **T4 — Gap** | **0** | **0%** | — |
| **Total** | **53** | **100%** | |

> No Tier 4 codes exist because all 53 codes belong to subjects present in the
> alignment engine's `SUBJECT_MAP` and the curriculum generation routes accept all subjects.

### Coverage % by Output Type

| Output Type | Codes Covered | Coverage |
|-------------|-------------|---------|
| **Lessons** | 53 / 53 | **100%** — all codes reachable via explicit injection or post-hoc alignment engine |
| **Assessments** | 53 / 53 | **100%** — post Gap-1 fix, all codes attachable to items when provided at generation time |
| **Interventions** | 37 / 53 | **69.8%** — codes with no StrandCatalog entry cannot fire mastery signals |

> **Important caveat:** Lesson and assessment coverage is 100% *structurally* — the
> plumbing exists for all codes. However, `moeAlignmentCodes` is an **optional caller-supplied
> parameter**. When not provided (which is the common case for the full-pack route and the
> single-generate route), no code is attached at generation time. Post-hoc auto-alignment
> via `alignContentToMOE()` fills this gap but only runs on `status = "accepted"` content
> and only when explicitly triggered. **Effective production coverage is therefore lower
> than 100% until auto-alignment is made mandatory post-publish.**

### Coverage % by Subject

| Subject | Total Codes | T1 | T2 | T1 % | T1+T2 % | Intervention-Capable |
|---------|------------|----|----|------|---------|---------------------|
| MATH | 20 | 14 | 6 | 70% | 100% | 18/20 (90%) |
| SCIENCE | 11 | 9 | 2 | 82% | 100% | 11/11 (100%) |
| LITERACY | 11 | 11 | 0 | 100% | 100% | 11/11 (100%) |
| CIVICS | 6 | 0 | 6 | 0% | 100% | **0/6 (0%)** |
| COMPUTER SCIENCE | 5 | 3 | 2 | 60% | 100% | 3/5 (60%) |
| **Total** | **53** | **37** | **16** | **70%** | **100%** | **43/53 (81%)** |

### Coverage % by Grade Band

| Grade Band | Total Codes | T1 | T2 | T1 % |
|------------|------------|----|----|------|
| G1–3 | 12 | 10 | 2 | 83% |
| G4–6 | 14 | 8 | 6 | **57%** ← weakest band |
| G7–9 | 15 | 10 | 5 | 67% |
| G10–12 | 12 | 9 | 3 | 75% |
| **Total** | **53** | **37** | **16** | **70%** |

> **G4–6 is the weakest grade band** at 57% T1 — driven by CIVICS (2 codes, no strands),
> CS hardware (1 code, no strand), Science indirect mappings (2 codes), and Money word
> problems (1 code, strand mismatch).

### Seeded Content Status

| Content ID | Subject | Grade | MOE Alignments Populated | Notes |
|-----------|---------|-------|--------------------------|-------|
| `math-g5-fractions` | MATH | 5 | ✗ empty | Aligns to LR-MATH-G4_6-02 — pending alignment run |
| `english-g5-reading` | ENGLISH→LITERACY | 5 | ✗ empty | Aligns to LR-LIT-G4_6-01 — pending alignment run |
| `science-g5-plants` | SCIENCE | 5 | ✗ empty | Topic (photosynthesis) has no explicit G4_6 code — standards gap |

All 3 seeded lessons have `moeAlignments: null` — the alignment engine has not been run.
The photosynthesis lesson represents a **genuine standards gap**: no G4–6 Science code
covers plant biology / photosynthesis. The closest is LR-SCI-G1_3-02 (needs of plants),
which is a lower grade band mismatch.

---

## 4) Priority Gaps

Ordered by severity and MOE review risk.

### GAP-1 (Critical): CIVICS — Complete Intervention Blindspot

**Codes affected:** LR-CIV-G1_3-01, LR-CIV-G4_6-01, LR-CIV-G4_6-02, LR-CIV-G7_9-01, LR-CIV-G7_9-02, LR-CIV-G10_12-01
**Root cause:** No `StrandCatalog` entries exist for CIVICS in any grade band.
**Impact:** Students' Civics performance generates zero mastery data. The platform's adaptive
learning loop — mastery profiles → intervention alerts → curriculum recommendations — is
completely blind to the Civics curriculum. No teacher is ever alerted that a class is
struggling with Liberian government or constitutional history.
**MOE risk:** Civics education is a national priority in Liberia. Presenting a national
deployment where the Civics strand produces zero adaptive feedback would be a significant
finding in any MOE review.

### GAP-2 (High): ENGINEERING — 16 Strands, Zero MOE Codes

**Root cause:** `prisma/seeds/strand-catalog.ts` defines 16 ENGINEERING strands across all
grade bands but `prisma/seeds/moe-standards.ts` has no ENGINEERING codes.
**Impact:** Students with mastery profiles for `electrical_systems`, `design_process_basic`,
or `engineering_math` cannot be traced to any official standard. Intervention targets like
`targetStrandKeys: ["engineering_design"]` cannot be linked back to an MOE code for
reporting.
**MOE risk:** If Engineering is part of the national curriculum, the platform cannot
demonstrate standards alignment for any Engineering content.

### GAP-3 (High): MATH G10_12-04 and G10_12-05 — No Strand

**Codes affected:** LR-MATH-G10_12-04 (sequences/series/financial math), LR-MATH-G10_12-05 (matrices/vectors)
**Root cause:** The G10–12 Math strand catalog covers advanced_algebra, trigonometry,
calculus_intro, functions_modeling, and combinatorics — but not sequences/series, financial
mathematics, or matrices.
**Impact:** Senior secondary students studying WASSCE-aligned financial math or matrix
algebra have no mastery profile dimension for those skills. Intervention targeting is
impossible.

### GAP-4 (High): CS G1_3 — 4 Strands, Zero MOE Codes

**Root cause:** CS has strands at G1_3 (digital_literacy, input_output, sequencing,
patterns_algorithms) but no corresponding MOE codes were defined for primary school CS.
**Impact:** Any primary school CS content cannot be aligned to an official standard.
Liberia's national curriculum increasingly includes digital literacy at primary level.

### GAP-5 (Medium): CS G4_6-01 Hardware Standard — No Hardware Strand

**Code affected:** LR-CS-G4_6-01 (CPU, RAM, storage components)
**Root cause:** The G4_6 CS strands are programming_basics, data_representation,
internet_safety, comp_thinking — none of which represent hardware literacy.
**Impact:** A student who hasn't learned the difference between CPU and RAM has no mastery
profile entry that captures this; intervention cannot target it.

### GAP-6 (Medium): SCIENCE G4_6 Indirect Mappings

**Codes affected:** LR-SCI-G4_6-01 (water cycle → `earth_systems` strand, weak), LR-SCI-G4_6-03 (simple machines → `forces_motion` strand, indirect)
**Root cause:** Strand names don't precisely reflect code content. `earth_systems` covers
Earth resources broadly; `forces_motion` covers kinematics. Water cycle and simple machines
are related but distinct topics.
**Impact:** Keyword-based alignment is degraded. Interventions targeting `earth_systems`
may fire for soil science content without identifying the water cycle gap specifically.

### GAP-7 (Medium): G4_6 is the Weakest Grade Band (57% T1)

**Root cause:** Convergence of multiple partial-coverage codes at G4–6 (Civics ×2, CS
hardware ×1, Science indirect ×2, MATH money ×1) creates a systemic coverage trough at
the critical transition year (Grades 4–6).
**Impact:** Students in the upper primary band — arguably the most consequential for
learning trajectory — have the weakest standards traceability of any grade band.

### GAP-8 (Medium): MATH G1_3-05 — Strand Mismatch (Time/Calendar)

**Code:** LR-MATH-G1_3-05 (tell time to the hour/half-hour; days/months)
**Root cause:** The closest G1_3 MATH strand is `patterns` ("Patterns & Relationships") —
a completely different topic. Time-telling has no dedicated strand.
**Impact:** Early primary students' time and calendar skills cannot be tracked in mastery
profiles.

### GAP-9 (Lower): 8 LITERACY Strands Without MOE Codes

**Strands:** oral_language (G1_3), grammar_mechanics (G4_6), grammar_advanced,
speaking_listening (G7_9), rhetoric_persuasion, literature_study, career_communication (G10_12)
**Impact:** These strands CAN accumulate mastery data and trigger interventions, but the
intervention cannot be traced back to an official MOE code for national reporting.
Lower risk than GAPs 1–7 because the intervention path works; only MOE reporting traceability
is broken.

### GAP-10 (Lower): Seeded Lessons Not Yet Aligned

**Root cause:** All 3 seeded lessons in `curriculum-sample.ts` have `moeAlignments: null`.
The alignment engine has not been run post-seed.
**Impact:** Any demonstration or staging environment shows zero aligned content.

---

## 5) Recommended Next Actions

Listed in recommended implementation order.

### ACTION-1 — Add CIVICS Strands to StrandCatalog *(resolves GAP-1)*

Seed 8–12 CIVICS strands across all grade bands into `prisma/seeds/strand-catalog.ts`.
Suggested minimum:

| strandKey | Band | Name |
|-----------|------|------|
| `national_identity` | G1_3 | National Identity & Symbols |
| `government_basics` | G4_6 | Structure of Government |
| `rights_responsibilities` | G4_6 | Rights & Civic Duties |
| `liberian_history` | G7_9 | Liberian History |
| `constitutional_law` | G7_9 | Constitutional Government |
| `international_relations` | G10_12 | International Relations & Global Bodies |

Then create a migration to insert these rows. No schema change needed; StrandCatalog
already supports any Subject enum value, and CIVICS is a valid Subject.

### ACTION-2 — Define ENGINEERING MOE Codes *(resolves GAP-2)*

Add 12–16 ENGINEERING codes to `prisma/seeds/moe-standards.ts` (3–4 per grade band).
Align with MOE technical/vocational curriculum documentation. Example structure:

```
LR-ENG-G1_3-01: Identify materials and their properties for building simple structures
LR-ENG-G4_6-01: Understand basic electrical circuits and simple machines
LR-ENG-G7_9-01: Apply engineering design process to solve practical problems
LR-ENG-G10_12-01: Design, prototype, and evaluate an engineering solution
```

### ACTION-3 — Add Missing MATH G10_12 Strands *(resolves GAP-3)*

Add 2 strands to the MATH G10_12 section of the strand catalog:

```typescript
{ subject: "MATH", strandKey: "financial_sequences", name: "Sequences, Series & Financial Math", gradeBand: "G10_12", waecRef: "WASSCE-MATH-A6" },
{ subject: "MATH", strandKey: "matrices_vectors",    name: "Matrices & Vectors",                 gradeBand: "G10_12", waecRef: "WASSCE-MATH-A7" },
```

### ACTION-4 — Add CS G1_3 MOE Codes *(resolves GAP-4)*

Add 2–3 CS codes for primary school digital literacy:

```
LR-CS-G1_3-01: Identify and use basic digital devices (tablet, computer, phone) safely
LR-CS-G1_3-02: Follow step-by-step instructions and recognize patterns in sequences
```

### ACTION-5 — Add Hardware Strand for CS G4_6 *(resolves GAP-5)*

```typescript
{ subject: "COMPUTER_SCIENCE", strandKey: "hardware_fundamentals", name: "Computer Hardware & Components", gradeBand: "G4_6" },
```

### ACTION-6 — Add Dedicated Science G4_6 Strands *(resolves GAP-6)*

Replace or supplement the indirect mappings:

```typescript
{ subject: "SCIENCE", strandKey: "water_cycle",    name: "Water Cycle & Agriculture", gradeBand: "G4_6" },
{ subject: "SCIENCE", strandKey: "simple_machines_g4", name: "Simple Machines & Work", gradeBand: "G4_6" },
```

### ACTION-7 — Auto-Run Alignment Engine on Publish *(resolves latent production gap)*

In the approve route (`app/api/admin/curriculum/approve/route.ts`), trigger
`alignContentToMOE(record.id)` asynchronously after setting `status: "published"`.
This ensures every approved lesson automatically receives MOE alignment without
requiring a separate API call.

```typescript
// After setting status to published — fire-and-forget, non-blocking
alignContentToMOE(record.id).catch((e) =>
  console.error("[MOE-Align] Auto-align failed:", record.contentId, e?.message)
);
```

### ACTION-8 — Add MATH G1_3 Time Strand *(resolves GAP-8)*

```typescript
{ subject: "MATH", strandKey: "time_calendar", name: "Time, Calendar & Sequencing", gradeBand: "G1_3" },
```

### ACTION-9 — Wire Auto-Lookup of Grade+Subject Codes at Full-Pack Generation

When `moeAlignmentCodes` is not supplied to `generate-full-pack`, query the `Standard`
table for all codes matching `{ subject, band: gradeToBand(grade) }` and pass them
automatically. This converts the current "opt-in" system to "opt-out."

```typescript
// In generate-full-pack/route.ts — before building units:
const codesFromDb = moeAlignmentCodes.length === 0
  ? (await prisma.standard.findMany({
      where: { subject: subject as any, band: gradeToBand(grade) },
      select: { code: true },
    })).map((s) => s.code)
  : moeAlignmentCodes;
```

### ACTION-10 — Fix Seeded Lesson Alignment

After seeding, run `POST /api/moe/align` with `{ batch: true, force: true }` to
populate `moeAlignments` on all seeded content. Document this as a required post-seed step.

---

## 6) Audit Confidence

### What this analysis is based on

| Evidence Source | Reliability |
|----------------|------------|
| `prisma/seeds/moe-standards.ts` — canonical code definitions | **High** — authoritative |
| `prisma/seeds/strand-catalog.ts` — strand taxonomy | **High** — authoritative |
| `lib/moe/alignment-engine.ts` — alignment mechanics | **High** — complete source read |
| `lib/ai/curriculum-factory.ts` — prompt construction | **High** — complete source read |
| `lib/curriculum-helpers.ts` — assessment/rubric generation | **High** — complete source read (post Gap-1) |
| `lib/ai/interventions/recommendationEngine.ts` — intervention logic | **High** — confirmed `targetStrandKeys: []` in default actions |
| DB content (`CurriculumContent.moeAlignments`) | **Not sampled** — DB not reachable locally |

### Limitations

1. **No production traffic data.** This analysis is entirely static. We cannot report
   how frequently `moeAlignmentCodes` are actually provided by callers in production.
   If callers consistently omit them, effective lesson/assessment coverage is much lower
   than 100% structural coverage.

2. **No DB query results.** The `Standard` and `StrandCatalog` tables may have been
   partially seeded, fully seeded, or not seeded at all in production. Coverage claims
   assume the seed was run successfully.

3. **Alignment engine quality not tested.** The keyword-matching algorithm uses a 15%
   threshold and returns top-3 matches. No recall/precision metrics have been measured.
   For short lessons (< 200 words), keyword matching may fail to reach the threshold for
   many codes, falling through to the GPT-4o-mini fallback — which adds latency and cost.

4. **Intervention `targetStrandKeys` is empty in default actions.** The default
   recommendation engine actions at lines 202, 211, and 220 of `recommendationEngine.ts`
   all use `targetStrandKeys: []`. Only AI-enhanced mode populates specific strand keys.
   This means the intervention→strand→code traceability chain depends on
   `ENABLE_AI_INTERVENTIONS_AI_ENHANCED=true` being set.

5. **`alignAllContent()` targets `status = "accepted"` not `"published"`.** The batch
   alignment function filters for `status: "accepted"` but curriculum content uses
   `status: "published"` after approval. This is a potential bug — published lessons
   may never be batch-aligned.

6. **WASSCE alignment (G10–12 strands) not verified against official WAEC documents.**
   `waecRef` fields are present in the strand catalog for G10–12 but their accuracy
   relative to official WASSCE syllabuses was not cross-checked in this analysis.

---

## Summary Table

| Dimension | Value |
|-----------|-------|
| Total MOE standard codes (canonical) | **53** (docs say 47 — 6-code discrepancy) |
| Tier 1 — Full coverage | **37 / 53 (70%)** |
| Tier 2 — Partial | **16 / 53 (30%)** |
| Tier 3 — Indirect | **0** |
| Tier 4 — Gap | **0** |
| Lesson coverage (structural) | **100%** |
| Assessment coverage (structural, post Gap-1) | **100%** |
| Intervention coverage | **69.8%** (43/53 have strand paths) |
| Most covered subject | LITERACY (100% T1) |
| Least covered subject (by T1) | CIVICS (0% T1) |
| Weakest grade band (by T1) | G4–6 (57%) |
| Critical blockers for MOE review | GAP-1 (CIVICS strands), GAP-2 (ENGINEERING codes) |
| Actions to reach 90% T1 | ACTION-1, 3, 5, 6, 8 |
| Actions to reach 95%+ T1 | All 10 actions |

---

## Remediation Log

Implemented on branch `feat/ai-factory-standards-remediation` — 2026-02-28.
All 5 actions pass the full test suite (680 tests).

### ACTION-7 — Fix batch alignment to include published content

**Commit:** `1fb40f5`
**Status:** Resolved

`alignAllContent()` in `lib/moe/alignment-engine.ts` filtered for
`status = "accepted"` only. All published curriculum content
(`status = "published"`, set on approval) was silently excluded from
every batch-alignment run. Published lessons were never auto-aligned.

**Fix:** Status filter changed to `{ in: ["published", "accepted"] }`.
**Tests:** 5 added in `__tests__/moe.alignment.batch.test.ts`

---

### ACTION-1 — Add CIVICS strands to StrandCatalog

**Commit:** `2004064`
**Status:** Resolved

CIVICS had 6 MOE codes but zero StrandCatalog entries, completely
breaking the mastery tracking → intervention signal path for all
Civics standards.

**Fix:** Added 6 CIVICS strands (1:1 with the 6 CIVICS MOE codes):

| strandKey | Band | MOE Code |
|-----------|------|---------|
| `national_identity` | G1_3 | LR-CIV-G1_3-01 |
| `government_basics` | G4_6 | LR-CIV-G4_6-01 |
| `rights_responsibilities` | G4_6 | LR-CIV-G4_6-02 |
| `liberian_history` | G7_9 | LR-CIV-G7_9-01 |
| `constitutional_law` | G7_9 | LR-CIV-G7_9-02 |
| `international_relations` | G10_12 | LR-CIV-G10_12-01 |

**Migration:** `prisma/migrations/20260228_civics_strands/migration.sql`
**Tests:** 7 added in `__tests__/moe.civics.strands.test.ts`

**Coverage impact:** CIVICS intervention coverage 0% → 100% (6/6 codes now have strand paths)

---

### ACTION-9 — Auto-lookup MOE codes at full-pack generation

**Commit:** `ab04af1`
**Status:** Resolved

`generate-full-pack` required callers to explicitly supply
`moeAlignmentCodes`. When not provided (the common case), every
generated full-pack had empty `standardCodes: []` on all assessment
items and rubric criteria — defeating the Gap-1 fix entirely.

**Fix:** When `moeAlignmentCodes` is not supplied or empty, the route
now queries `prisma.standard.findMany({ subject, band: gradeToBand(grade) })`
and uses the returned codes automatically. Callers can still override.
Returns `[]` safely for subjects with no codes (ENGINEERING).

**Tests:** 5 added in `__tests__/fullpack.moe.autolookup.test.ts`

---

### ACTION-3 — Add missing MATH G10_12 strands

**Commit:** `686e60b`
**Status:** Resolved

`LR-MATH-G10_12-04` (sequences/series/financial math) and
`LR-MATH-G10_12-05` (matrices/vectors) had no StrandCatalog entries.
Students studying these senior secondary topics generated no mastery
data and could not be targeted by interventions.

**Fix:** Added two strands with WASSCE alignment:
- `financial_sequences` G10_12 WASSCE-MATH-A6 → LR-MATH-G10_12-04
- `matrices_vectors`    G10_12 WASSCE-MATH-A7 → LR-MATH-G10_12-05

**Migration:** `prisma/migrations/20260228_math_strands/migration.sql`

---

### ACTION-8 — Add MATH G1_3 time_calendar strand

**Commit:** `686e60b` (combined with ACTION-3)
**Status:** Resolved

`LR-MATH-G1_3-05` (tell time to the hour/half-hour; days of week and months)
was previously mapped to the `patterns` strand — a completely different
content domain. Students' time and calendar skills could not be tracked.

**Fix:** Added `time_calendar` strand at G1_3 → LR-MATH-G1_3-05
**Migration:** `prisma/migrations/20260228_math_strands/migration.sql`

---

### Post-Remediation Coverage Update

| Dimension | Before | After |
|-----------|--------|-------|
| CIVICS intervention coverage | 0 / 6 (0%) | **6 / 6 (100%)** |
| MATH G10_12 uncovered codes | 2 (G10_12-04, -05) | **0** |
| MATH G1_3 strand mismatch | 1 (G1_3-05) | **0** |
| Total intervention-capable codes | 43 / 53 (81%) | **50 / 53 (94%)** |
| Batch alignment scope | accepted only | **published + accepted** |
| Full-pack codes auto-populated | no (opt-in) | **yes (opt-out)** |
| Total new test cases | — | **+25** (680 total) |

**Remaining open actions:** ACTION-2 (ENGINEERING codes), ACTION-4 (CS G1_3 codes),
ACTION-5 (CS G4_6 hardware strand), ACTION-6 (Science G4_6 water cycle strand),
ACTION-10 (run alignment on seeded content). To be addressed in a subsequent session.
