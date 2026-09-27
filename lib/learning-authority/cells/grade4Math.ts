import type { CellLesson, CellObjective, CellUnit, InteractionSpec, TemplateCell } from "../templateCell";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";

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

type Planned = NonNullable<InteractionSpec["plannedEnhancement"]>;
/** A planned digital modality is a recorded product gap, never an implemented tool. */
const gap = (gapCode: string, need: Planned["need"], description: string) => ({ plannedEnhancement: { gapCode, need, description } });

const manip = (rationale: string, tools: string[], offlineFallback: string, planned: { plannedEnhancement?: Planned } = {}): InteractionSpec =>
  ({ need: "MANIPULATIVE_2D", rationale, tools, labId: null, evidence: "GOVERNED_ITEM_RESPONSE", offlineFallback, safety: null, ...planned });

const practical = (rationale: string, offlineFallback: string, safety: string, tools: string[] = [], planned: { plannedEnhancement?: Planned } = {}): InteractionSpec =>
  ({ need: "PRACTICAL", rationale, tools, labId: null, evidence: "TEACHER_OBSERVATION", offlineFallback, safety, ...planned });

const FRACTION_STRIPS = manip("Learners build and partition wholes with fraction strips to see equal parts.", ["fraction-visualizer"], "Paper strips folded into equal parts (MOE material: paper, orange fraction strips).");
const NUMBER_LINE = manip("Learners place and move values on a number line to compare, order or round.", ["number-line"], "Number line drawn in the exercise book or on the floor with chalk.");

const obj = (topic: keyof typeof T, n: number, interaction: InteractionSpec = none, conceptIds: string[] = []): CellObjective =>
  ({ moeItemId: `${T[topic]}-obj${n}`, conceptIds, interaction });

/** Draft lessons bind to their MOE objective with every payload component; no concepts or governed items. */
const draftLessonsFor = (unitId: string): CellLesson[] => GRADE4_MATH_DRAFT_LESSONS.filter((lesson) => lesson.unitId === unitId).map((lesson) => ({
  contentId: lesson.contentId,
  version: lesson.version,
  authority: "DRAFT_UNREVIEWED",
  conceptIds: [],
  objectiveIds: [lesson.moeObjectiveId],
  components: [
    { kind: "CLASSWORK", source: "LESSON_PAYLOAD", ref: "activities" },
    { kind: "PRACTICE", source: "LESSON_PAYLOAD", ref: "practice" },
    { kind: "HOMEWORK", source: "LESSON_PAYLOAD", ref: "homework" },
    { kind: "QUIZ", source: "LESSON_PAYLOAD", ref: "quiz" },
    { kind: "DIAGNOSTIC", source: "LESSON_PAYLOAD", ref: "diagnosticCheck" },
    { kind: "ASSESSMENT", source: "LESSON_PAYLOAD", ref: "assessment" },
  ],
}));
const withDrafts = (unit: CellUnit): CellUnit => ({ ...unit, lessons: [...unit.lessons, ...draftLessonsFor(unit.id)] });

const CELL: TemplateCell = {
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
        obj("m1", 1, manip("Learners build and read numbers by placing digit cards or place-value strips in a place-value chart (MOE mat1: place value chart and strips).", [],
          "Place-value chart drawn in exercise books or on the board, with paper digit cards and place-value strips.",
          gap("GRADE_4_6_PLACE_VALUE_MANIPULATIVE", "MANIPULATIVE_2D", "No online place-value chart tool is registered; the paper chart and strips are the core modality."))),
        obj("m1", 2, NUMBER_LINE),
        obj("m1", 3, NUMBER_LINE),
        obj("m1", 4),
      ],
    },
    {
      id: "g4-math-u2-multiply-divide-whole", sequence: 2, moeTopicKey: T.m2, lessons: [],
      objectives: [
        obj("m2", 1, manip("Learners explore facts and properties (commutative, zero, one) by building arrays in the multiplication table.", ["multiplication-table"], "Arrays of bottle caps or dots drawn in rows and columns.")),
        obj("m2", 2),
        obj("m2", 3, manip("Learners draw and split an area model on graph paper and count squares to see each partial product (MOE act2: graph-paper rectangle).", [],
          "Graph or squared exercise-book paper; rectangles drawn, split and shaded by hand.",
          gap("GRADE_4_6_GRID_MANIPULATIVE", "MANIPULATIVE_2D", "No Grade 4-6 grid tool is enabled online; squared paper is the core modality."))),
        obj("m2", 4), obj("m2", 5), obj("m2", 6),
      ],
    },
    {
      id: "g4-math-u3-number-theory-fractions", sequence: 3, moeTopicKey: T.m3,
      objectives: [
        obj("m3", 1),
        obj("m3", 2, manip("Learners find factor pairs and multiples by reading rows and columns of the multiplication table.", ["multiplication-table"], "Hand-drawn multiplication chart; skip-counting on a hundred chart.")),
        obj("m3", 3),
        obj("m3", 4, manip("Learners form sets of bottle caps or stones and mark part of the set to find parts of a set; fraction strips model parts of one whole.", ["fraction-visualizer"],
          "Bottle caps or stones for sets (required); folded paper strips for wholes.",
          gap("SET_FRACTION_MANIPULATIVE_REQUIRED", "MANIPULATIVE_2D", "The fraction-visualizer partitions one whole into strips; it does not let a learner build a set of objects and mark part of it. Bottle caps or stones remain the required modality.")),
          ["g4-fractions-equal-parts"]),
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
          authority: "GOVERNED",
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
        obj("m5", 2, manip("Learners move clock hands to find elapsed time.", [], "Paper-plate clock with a split-pin for the hands.",
          gap("GRADE_4_6_CLOCK_MANIPULATIVE", "MANIPULATIVE_2D", "No Grade 4-6 clock tool is enabled online; the paper-plate clock is the MOE-aligned core modality (MOE mat1: toy or paper clock)."))),
        obj("m5", 3, practical("Estimating length needs a physical benchmark (a hand span, a foot).", "Estimate then measure classroom objects with body benchmarks.", "Keep walkways clear when measuring the room.")),
        obj("m5", 4, practical("Measuring requires handling a real ruler or tape and aligning zero.", "Rulers or a marked string; learners record measurements.", "No sharp tools; blunt-ended rulers only.", ["digital-ruler"])),
        obj("m5", 5, practical("Mass and capacity are only meaningful when learners lift and pour.", "Compare containers and objects by lifting and filling with water or sand.", "Use water or dry sand only; wipe spills to prevent slipping.")),
        obj("m5", 6, practical("Metric estimation needs physical benchmarks (1 m stick, 1 L bottle, 1 kg bag).", "Benchmark objects brought from home or market.", "Use water or dry sand only; wipe spills to prevent slipping.")),
        obj("m5", 7), obj("m5", 8),
        obj("m5", 9, manip("Learners draw rectangles on a square grid and count unit squares and edge lengths.", [],
          "Squared exercise-book paper or a chalk grid: the accepted core modality for Grade 4 area and perimeter.",
          gap("GRADE_4_6_GRID_MANIPULATIVE", "MANIPULATIVE_2D", "No Grade 4-6 grid tool is enabled online (coordinate-grid is Grades 7+). The digital grid is an enhancement and does not block lesson approval."))),
      ],
    },
    {
      id: "g4-math-u6-geometry-statistics", sequence: 6, moeTopicKey: T.m6, lessons: [],
      objectives: [
        obj("m6", 1),
        obj("m6", 2, manip("Learners test angles against a right angle and turn rays to see smaller and larger angles.", [], "Folded-paper right-angle tester used on classroom corners.",
          gap("GRADE_4_6_ANGLE_TESTER", "MANIPULATIVE_2D", "No Grade 4-6 angle tool is enabled online (the protractor is Grades 7+ and Grade 4 does not measure degrees); the folded-paper tester is the core modality."))),
        obj("m6", 3, manip("Learners build polygons from sticks and sort paper cut-outs by number of sides (MOE act3: sort polygons according to sides).", [],
          "Sticks or straws and paper cut-out shapes.",
          gap("GRADE_4_6_SHAPE_SORT_MANIPULATIVE", "MANIPULATIVE_2D", "No online shape-building or sorting tool is registered; sticks and cut-outs are the core modality."))),
        obj("m6", 4, manip("Learners trace, cut out and fold paper circles to find the centre, a diameter and a radius (MOE act4, act5).", [],
          "Paper circles traced from a cup or lid, cut out and folded; string-and-chalk circles outdoors.",
          gap("GRADE_4_6_CIRCLE_MANIPULATIVE", "MANIPULATIVE_2D", "No online circle-parts tool is registered; folded paper circles are the core modality."))),
        obj("m6", 5, practical(
          "Learners handle and turn real solids to find and count faces, edges and vertices, including the ones a picture hides.",
          "Real objects: ball (sphere), closed tin (cylinder), paper cone hat (cone), die (cube), box or brick (rectangular prism).",
          "Use clean, unbroken objects; bricks stay on the desk and are not thrown or dropped.", [],
          gap("GRADE_4_6_SOLIDS_3D_VIEWER", "THREE_D", "Planned, not implemented: a 3D solids viewer in which learners rotate each solid and inspect hidden faces, edges and vertices. It augments the real-object experience and never replaces it. No 3D runtime exists today."))),
        obj("m6", 6, practical(
          "Learners collect voluntary, anonymous family-size data (MOE act6), display it as a bar graph and read the mode from it.",
          "Tally anonymous slips on the board; draw the bar graph on squared paper or the board.",
          "Participation is voluntary and anonymous: no names on slips, and a learner may decline without giving a reason. Evidence today is teacher-observed data collection; governed responses to the graph-reading items are the planned second evidence source.")),
        obj("m6", 7), obj("m6", 8),
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

export const GRADE4_MATH_TEMPLATE_CELL: TemplateCell = { ...CELL, version: "1.1.0", units: CELL.units.map(withDrafts) };
