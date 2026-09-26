import type { CellObjective, InteractionSpec, TemplateCell } from "../templateCell";

/**
 * Grade 4 Math governed template cell (V1).
 *
 * Units are the six MOE Grade 4 Math topic tables (GRADE-1-6/Math 1-6.pdf,
 * pages 38-49), structured in curriculum/structured/moe-structured-v1.json.
 * Every one of the 44 MOE objectives is placed and has an explicit
 * interaction classification under the LiberiaLearn interaction standard:
 * 3D only where spatial manipulation materially improves learning,
 * manipulatives must involve real learner manipulation, labs must produce
 * evidence, and every interaction has an offline fallback.
 *
 * Classifications are LiberiaLearn proposals (UNREVIEWED), not MOE statements.
 * Tools are limited to toolkit tools enabled for Grades 4-6 math; a need with
 * no enabled tool is recorded as an implementation gap, never faked.
 */

const T = {
  m1: "moe-math-g4-s1-p1-numeration-addition-and-subtraction",
  m2: "moe-math-g4-s1-p2-multiplication-and-division-of-whole-numbers",
  m3: "moe-math-g4-s1-p3-number-theory-and-fraction",
  m4: "moe-math-g4-s2-p4-multiplication-and-division-of-2-digits-multipli",
  m5: "moe-math-g4-s2-p5-measurement",
  m6: "moe-math-g4-s2-p6-geometry-and-statistics",
} as const;

const none: InteractionSpec = { need: "NONE", rationale: "", tools: [], labId: null, evidence: "NONE", offlineFallback: null, safety: null };

const manip = (rationale: string, tools: string[], offlineFallback: string): InteractionSpec =>
  ({ need: "MANIPULATIVE_2D", rationale, tools, labId: null, evidence: "GOVERNED_ITEM_RESPONSE", offlineFallback, safety: null });

const practical = (rationale: string, offlineFallback: string, safety: string, tools: string[] = []): InteractionSpec =>
  ({ need: "PRACTICAL", rationale, tools, labId: null, evidence: "TEACHER_OBSERVATION", offlineFallback, safety });

const FRACTION_STRIPS = manip("Learners build and partition wholes with fraction strips to see equal parts.", ["fraction-visualizer"], "Paper strips folded into equal parts (MOE material: paper, orange fraction strips).");
const NUMBER_LINE = manip("Learners place and move values on a number line to compare, order or round.", ["number-line"], "Number line drawn in the exercise book or on the floor with chalk.");

const obj = (topic: keyof typeof T, n: number, interaction: InteractionSpec = none, conceptIds: string[] = []): CellObjective =>
  ({ moeItemId: `${T[topic]}-obj${n}`, conceptIds, interaction });

export const GRADE4_MATH_TEMPLATE_CELL: TemplateCell = {
  id: "cell-g4-math-v1",
  version: "1.0.0",
  grade: 4,
  subject: "MATH",
  releaseId: "lr-moe-g4-math-fractions-2026.1",
  authority: { source: "VERIFIED_LIBERIA_MOE_SOURCE", liberiaLearnReviewState: "UNREVIEWED", moeApprovalState: "NOT_CLAIMED" },
  units: [
    {
      id: "g4-math-u1-numeration-add-subtract", sequence: 1, moeTopicKey: T.m1, lessons: [],
      objectives: [
        obj("m1", 1),
        obj("m1", 2, NUMBER_LINE),
        obj("m1", 3, NUMBER_LINE),
        obj("m1", 4),
      ],
    },
    {
      id: "g4-math-u2-multiply-divide-whole", sequence: 2, moeTopicKey: T.m2, lessons: [],
      objectives: [
        obj("m2", 1, manip("Learners explore facts and properties (commutative, zero, one) by building arrays in the multiplication table.", ["multiplication-table"], "Arrays of bottle caps or dots drawn in rows and columns.")),
        obj("m2", 2), obj("m2", 3), obj("m2", 4), obj("m2", 5), obj("m2", 6),
      ],
    },
    {
      id: "g4-math-u3-number-theory-fractions", sequence: 3, moeTopicKey: T.m3,
      objectives: [
        obj("m3", 1),
        obj("m3", 2, manip("Learners find factor pairs and multiples by reading rows and columns of the multiplication table.", ["multiplication-table"], "Hand-drawn multiplication chart; skip-counting on a hundred chart.")),
        obj("m3", 3),
        obj("m3", 4, FRACTION_STRIPS, ["g4-fractions-equal-parts"]),
        obj("m3", 5, FRACTION_STRIPS, ["g4-fractions-equivalence"]),
        obj("m3", 6, FRACTION_STRIPS),
        obj("m3", 7, FRACTION_STRIPS),
        obj("m3", 8, FRACTION_STRIPS),
        obj("m3", 9),
      ],
      lessons: [
        {
          contentId: "ll-g4-math-fractions-equal-parts-2026.1",
          version: "1.0.0",
          conceptIds: ["g4-fractions-equal-parts"],
          objectiveIds: [`${T.m3}-obj4`],
          components: [
            { kind: "CLASSWORK", source: "LESSON_PAYLOAD", ref: "activities" },
            { kind: "HOMEWORK", source: "LESSON_PAYLOAD", ref: "homework" },
            { kind: "ASSESSMENT", source: "LESSON_PAYLOAD", ref: "assessment" },
            { kind: "DIAGNOSTIC", source: "GOVERNED_ITEM", ref: "g4-frac-diagnostic-equal-parts" },
          ],
        },
      ],
    },
    {
      id: "g4-math-u4-two-digit-decimals", sequence: 4, moeTopicKey: T.m4, lessons: [],
      objectives: [
        obj("m4", 1), obj("m4", 2), obj("m4", 3), obj("m4", 4), obj("m4", 5), obj("m4", 6),
        obj("m4", 7, manip("Learners locate tenths and hundredths on a number line to connect decimal notation to place value.", ["number-line"], "Hundredths grid shaded in the exercise book.")),
        obj("m4", 8, NUMBER_LINE),
      ],
    },
    {
      id: "g4-math-u5-measurement", sequence: 5, moeTopicKey: T.m5, lessons: [],
      objectives: [
        obj("m5", 1, practical("Estimating time needs lived duration: learners estimate, then time real classroom tasks.", "Teacher-led timing with a wall clock or phone; learners record estimate vs actual.", "None beyond normal classroom supervision.")),
        obj("m5", 2, manip("Learners move clock hands to find elapsed time.", [], "Paper-plate clock with a split-pin for the hands.")),
        obj("m5", 3, practical("Estimating length needs a physical benchmark (a hand span, a foot).", "Estimate then measure classroom objects with body benchmarks.", "Keep walkways clear when measuring the room.")),
        obj("m5", 4, practical("Measuring requires handling a real ruler or tape and aligning zero.", "Rulers or a marked string; learners record measurements.", "No sharp tools; blunt-ended rulers only.", ["digital-ruler"])),
        obj("m5", 5, practical("Mass and capacity are only meaningful when learners lift and pour.", "Compare containers and objects by lifting and filling with water or sand.", "Use water or dry sand only; wipe spills to prevent slipping.")),
        obj("m5", 6, practical("Metric estimation needs physical benchmarks (1 m stick, 1 L bottle, 1 kg bag).", "Benchmark objects brought from home or market.", "Use water or dry sand only; wipe spills to prevent slipping.")),
        obj("m5", 7), obj("m5", 8),
        obj("m5", 9, manip("Learners draw rectangles on a square grid and count unit squares and edge lengths.", [], "Squared exercise-book paper or a chalk grid.")),
      ],
    },
    {
      id: "g4-math-u6-geometry-statistics", sequence: 6, moeTopicKey: T.m6, lessons: [],
      objectives: [
        obj("m6", 1),
        obj("m6", 2, manip("Learners test angles against a right angle and turn rays to see smaller and larger angles.", [], "Folded-paper right-angle tester used on classroom corners.")),
        obj("m6", 3), obj("m6", 4),
        obj("m6", 5, {
          need: "THREE_D",
          rationale: "Rotating solids lets learners see hidden faces, edges and vertices that a flat picture cannot show; spatial manipulation materially changes what they can identify.",
          tools: [], labId: null, evidence: "GOVERNED_ITEM_RESPONSE",
          offlineFallback: "Real objects: cans (cylinder), balls (sphere), boxes (rectangular prism), cone-shaped paper hats (cone).",
          safety: null,
        }),
        obj("m6", 6), obj("m6", 7), obj("m6", 8),
      ],
    },
  ],
  conceptLinks: [
    { conceptId: "g4-fractions-equal-parts", basis: "MOE_OBJECTIVE", moeObjectiveIds: [`${T.m3}-obj4`],
      note: "MOE p.42 'Find parts of a set'. The bound lesson teaches part-of-a-whole and models sets with bottle caps; set interpretation is covered by its activities." },
    { conceptId: "g4-fractions-equivalence", basis: "MOE_OBJECTIVE", moeObjectiveIds: [`${T.m3}-obj5`],
      note: "MOE p.42 'Write equivalent fractions'." },
    { conceptId: "g4-fractions-compare", basis: "LIBERIALEARN_EXTENSION", moeObjectiveIds: [],
      note: "Comparing fractions is not a Grade 4 MOE objective in the structured source. Kept as a LiberiaLearn extension; it must not be reported as MOE-aligned." },
  ],
};
