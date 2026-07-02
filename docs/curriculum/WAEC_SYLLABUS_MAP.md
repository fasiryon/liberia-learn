# WAEC Syllabus Map — Phase 5A Foundation

> Canonical map of WAEC / WASSCE subjects and syllabus topics used by the LiberiaLearn
> **WAEC Prep** track. The machine-readable source of truth is
> [`lib/waec/syllabus.ts`](../../lib/waec/syllabus.ts); this document is the human
> reference and citation record.

## Purpose

This map exists so that:

1. Existing Grade 9+ `CurriculumContent` can be **tagged** to WAEC syllabus topics
   (`CurriculumContent.waecSyllabusTopics`).
2. Per-student **WAEC readiness** can be computed by aggregating mastery across the
   strands that each topic draws from.
3. **Practice sessions** (Surface sprint) can select real past-paper-style content by
   subject + topic.

WAEC subject ids are **decoupled from the Prisma `Subject` enum** (which is coarse:
`MATH, SCIENCE, LITERACY, …`). A single mastery `SCIENCE` bucket is split into distinct
WAEC subjects (Physics, Chemistry, Biology) via strand-level mapping — see below.

## Sources

The topic lists below are drawn from the **published WAEC WASSCE regional syllabus**
(the syllabus applies across WAEC member states, Liberia included). Primary and
aggregator sources consulted:

- The West African Examinations Council (official) — <https://www.waeconline.org.ng/>
- WAEC WASSCE Physics syllabus — <https://waecsyllabus.com/physics/>
  (Interaction of Matter/Space/Time; Energy: Mechanical & Heat; Waves; Fields; Atomic & Nuclear)
- WAEC WASSCE Geography syllabus — <https://waecsyllabus.com/geography/>
  (Physical Geography; Economic & Human Geography; Regional Geography incl. **Liberia**; Field Work)
- WAEC WASSCE English Language syllabus — <https://waecsyllabus.com/english-language/>
- WAEC WASSCE Literature-in-English syllabus — <https://waecsyllabus.com/download/ssce/LITERATURE%20IN%20ENGLISH.pdf>
- WAEC WASSCE Biology — five broad units (variety of living things, organisation of life,
  evolution, continuity of life, ecology), via <https://www.waeconline.org.ng/> and
  <https://syllabus.ng/waec/>
- WAEC WASSCE Mathematics (Core) and Chemistry — <https://syllabus.ng/waec/> /
  <https://waecsyllabus.com/>

> Topic **granularity** here is at the level of the syllabus's top-level content sections,
> not every sub-item. This is sufficient for tagging and readiness. Sub-topic expansion is
> a future refinement.

## Subjects & topics

Exam weights are relative emphasis (normalised at read time across *covered* topics), not
official mark allocations. "Strands" are `StrandCatalog` entries the topic's mastery is read
from; an empty list means no mastery strand exists yet.

### WAEC Mathematics — mastery bucket `MATH`
| Topic id | Name | Strands |
|---|---|---|
| `math.number_numeration` | Number & Numeration | expressions_eqs, financial_sequences |
| `math.algebraic_processes` | Algebraic Processes | advanced_algebra, algebra_basics, expressions_eqs |
| `math.geometry_mensuration` | Geometry & Mensuration | geometry_proofs, functions_modeling |
| `math.trigonometry` | Trigonometry | trigonometry |
| `math.coordinate_calculus` | Coordinate Geometry & Introductory Calculus | calculus_intro, functions_modeling |
| `math.statistics_probability` | Statistics & Probability | statistics_prob, combinatorics |
| `math.vectors_transformation` | Vectors & Transformation | matrices_vectors |

### WAEC English Language — mastery bucket `LITERACY`
Comprehension · Summary · Lexis & Structure · Oral English · Essay & Continuous Writing.
Strands: critical_analysis, academic_writing, research_skills, grammar_advanced,
speaking_listening, argumentative_writing, rhetoric_persuasion, literary_analysis.

### WAEC Physics — mastery bucket `SCIENCE`
Interaction of Matter/Space/Time · Mechanics & Motion · Heat & Thermal · Waves/Sound/Optics ·
Electricity & Magnetism · Atomic & Nuclear.
Strands: `physics_mechanics` (G10–12), `physics_energy` (G7–9), `scientific_method`.

### WAEC Chemistry — mastery bucket `SCIENCE`
Separation of Matter · Atomic Structure & Bonding · Mole & Stoichiometry · Acids/Bases/Salts ·
Energetics/Rates/Equilibrium/Electrochemistry · Organic Chemistry · Metals & Industry.
Strands: `chemistry_basics` (G7–9), `organic_chemistry` (G10–12), `scientific_method`.

### WAEC Biology — mastery bucket `SCIENCE`
Variety of Living Things · Organisation of Life · Continuity of Life · Evolution · Ecology.
Strands: `cells_biology`, `genetics_intro`, `advanced_biology`, `ecology_advanced`, `env_science`.

### WAEC Literature-in-English — mastery bucket `LITERACY`
Drama · Prose · Poetry · Literary Appreciation & Unseen.
Strands: `literature_study` (G10–12), `critical_analysis`, `literary_analysis`.

### WAEC Geography — mastery bucket **none (gap)**
Physical Geography · Human & Economic Geography · Regional Geography (West Africa & Liberia) ·
Practical & Field Work.

> **⚠ Known gap.** Geography has **no `StrandCatalog` strand and no `Subject`-enum bucket**.
> Content can be tagged with Geography topics, but **readiness cannot be computed** for
> Geography until strands are added (which requires a `Subject`-enum expansion — deliberately
> out of scope for Foundation to avoid a broad core migration). The Surface dashboard must
> render WAEC Geography as **"coming soon / not yet available"**, never as a degraded/fabricated
> score. See Doc B.

## Why Physics/Chemistry/Biology can be distinguished despite one `SCIENCE` bucket

The `SCIENCE` mastery bucket already contains **subject-distinct strands** carrying WASSCE
references (`physics_mechanics`→WASSCE-PHY, `organic_chemistry`→WASSCE-CHEM,
`advanced_biology`/`ecology_advanced`→WASSCE-BIO). WAEC Physics readiness reads only physics
strands, Chemistry only chemistry strands, etc. — so the three subjects yield genuinely
different readiness scores from the same enum bucket, with no fabrication.

## Stability contract

- Topic ids and subject ids are **persisted** in `CurriculumContent.waecSyllabusTopics`.
- **Never rename** an existing id. Add new ids for new topics.
- Strand mappings and exam weights may be tuned without a data migration (readiness is
  recomputed on read).
