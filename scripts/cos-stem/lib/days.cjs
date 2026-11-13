/**
 * K-12 day plans from band templates (CoS). Grades with a hand-authored plan (day-plans/*.json) keep it;
 * every other grade gets a generated Day 1 whose teaching, support and end-of-day slots are CONTENT_GAP
 * with a factory generation order. A gap is never filled with text here: only the Content Factory
 * produces lessons, and only a pinned package can replace a gap.
 */
const { PATTERNS, COURSE_FAMILY, COMPUTING, ENGINEERING, DEVELOPMENTAL, developmentalBand } = require("../../../curriculum/program/stem-v1/source/standards.cjs");

/** Codex STANDARD_45 anchors; the afternoon is split into differentiated support and an end-of-day activity. */
const BELL = [
  ["ARRIVAL", "07:30", "08:00"], ["ASSEMBLY", "08:00", "08:20"], ["P1", "08:20", "09:10"], ["P2", "09:10", "10:00"],
  ["BREAK", "10:00", "10:20"], ["P3", "10:20", "11:10"], ["P4", "11:10", "12:00"], ["LUNCH", "12:00", "12:40"],
  ["P5", "12:40", "13:30"], ["P6", "13:30", "14:20"], ["SUPPORT", "14:20", "14:40"], ["END_OF_DAY", "14:40", "14:50"], ["DISMISSAL", "14:50", "15:00"],
];
const TEACHING = ["P1", "P2", "P3", "P4", "P5", "P6"];

/** Day 1 course order by grade. Each day carries S, T, E and M; other courses rotate on later days. */
function dayCourses(grade) {
  if (grade <= 2) return ["ENGLISH", "MATH", "SCIENCE", "ENGINEERING", "COMPUTING", "SOCIAL_STUDIES"];
  if (grade <= 5) return ["MATH", "SCIENCE", "ENGLISH", "SOCIAL_STUDIES", "COMPUTING", "ENGINEERING"];
  if (grade <= 9) return ["MATH", "SCIENCE", "ENGLISH", "CIVICS", "COMPUTING", "ENGINEERING"];
  const sciences = { 10: ["PHYSICS", "CHEMISTRY"], 11: ["CHEMISTRY", "BIOLOGY"], 12: ["BIOLOGY", "PHYSICS"] }[grade];
  return ["MATH", sciences[0], "ENGLISH", sciences[1], "COMPUTING", "ENGINEERING"];
}

/** Section B takes section A's period i+3, so no course sits in the same slot for both sections (one specialist covers both). */
const SECTION_B_OFFSET = 3;
const sectionBOrder = (order) => order.map((_, i) => order[(i + SECTION_B_OFFSET) % order.length]);

const PRACTICES = {
  MATHEMATICS: ["CONCEPT_BEFORE_PROCEDURE", "MATHEMATICAL_REASONING", "LIBERIAN_APPLICATION", "PRACTICE_CONTINUUM"],
  SCIENCE: ["SCIENTIFIC_EVIDENCE", "CONCEPT_BEFORE_PROCEDURE", "LIBERIAN_APPLICATION", "PRACTICE_CONTINUUM"],
  COMPUTING: ["COMPUTATIONAL_THINKING", "MATHEMATICAL_REASONING", "LIBERIAN_APPLICATION", "PRACTICE_CONTINUUM"],
  ENGINEERING: ["ENGINEERING_DESIGN", "MATHEMATICAL_REASONING", "SCIENTIFIC_EVIDENCE", "LIBERIAN_APPLICATION", "PRACTICE_CONTINUUM"],
  LANGUAGE: ["COMMUNICATION_AND_CRITICAL_THINKING", "LIBERIAN_APPLICATION", "PRACTICE_CONTINUUM"],
  HUMANITIES: ["COMMUNICATION_AND_CRITICAL_THINKING", "LIBERIAN_APPLICATION", "PRACTICE_CONTINUUM"],
};

const REQUIREMENTS = [
  "Two or three measurable objectives derived from the performance task; MOE mapping recorded as PROPOSED, never claimed",
  "At least two distinct, named misconceptions, each taught against and diagnosed by a block",
  "Hints in every guided scene; no hints or worked steps in independent scenes",
  "Choice items with three or more plausible options, or richer interactions",
  "No system, policy or answer-policy text in learner-visible fields; no generator prefixes; UTF-8 text with no mojibake",
  "Specific learner actions in every scene",
  "Guided practice, independent work, extension and reflection, in that order",
  "An authentic Liberian situation that needs the concept, not a name swap",
  "Formative only: no grade, mastery or assessment keys in the learner projection",
];

const gradeTag = (grade) => `G${String(grade).padStart(2, "0")}`;

function generationOrder(grade, slot, course, unit) {
  const fam = COURSE_FAMILY[course];
  const band = developmentalBand(grade);
  const competencies = fam.family === "COMPUTING" ? COMPUTING[band] : fam.family === "ENGINEERING" ? ENGINEERING[band] : null;
  return {
    orderId: `GO-${gradeTag(grade)}-${slot}-${course}-U${unit.unit}`,
    owner: "T2_CODEX",
    kind: "LESSON",
    batch: `BAND_${band}`,
    grade,
    courseId: unit.courseId,
    unit: unit.unit,
    unitTitle: unit.title,
    performanceTask: unit.performanceTask,
    family: fam.family,
    pattern: PATTERNS[fam.family],
    recordedSubject: fam.recordedSubjects[0],
    developmental: { band, ...DEVELOPMENTAL[band] },
    competencies,
    blocks: unit.blocks,
    labs: unit.labs,
    stemPractices: PRACTICES[fam.family],
    requirements: REQUIREMENTS,
    gates: ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"],
  };
}

function supportOrder(grade, kind) {
  const band = developmentalBand(grade);
  return kind === "SUPPORT"
    ? { orderId: `GO-${gradeTag(grade)}-SUPPORT`, owner: "T2_CODEX", kind: "DIFFERENTIATED_SUPPORT", batch: `BAND_${band}`, grade, developmental: { band, ...DEVELOPMENTAL[band] }, requirements: ["Retrieval items for P1-P6 objectives of the same day, no hints", "A targeted re-teach path per named misconception", "An extension path for learners who show mastery", "Formative only; the pilot stores nothing"], gates: ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"] }
    : { orderId: `GO-${gradeTag(grade)}-EOD`, owner: "T2_CODEX", kind: "END_OF_DAY_REFLECTION", batch: `BAND_${band}`, grade, developmental: { band, ...DEVELOPMENTAL[band] }, requirements: ["A ten-minute reflection that connects the day's STEM periods", band === "K-2" ? "Oral and picture responses; read-aloud prompts" : "A short written reflection and one question to carry to tomorrow", "Formative only"], gates: ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"] };
}

/** Build a generated Day 1 plan for a grade. `courses` is the program catalog. */
function buildGeneratedPlan(grade, courses) {
  const order = dayCourses(grade);
  const unitFor = (course) => {
    const c = courses.find((x) => x.grade === grade && x.course === course);
    if (!c) throw new Error(`${course} not in grade ${grade} catalog`);
    const u = c.units[0];
    return { ...u, courseId: c.courseId, blocks: c.blocks, labs: c.labs };
  };
  const blocks = BELL.map(([slot, start, end]) => {
    const i = TEACHING.indexOf(slot);
    if (i >= 0) {
      const course = order[i];
      const unit = unitFor(course);
      return {
        slot, start, end, course, unit: unit.unit,
        binding: {
          kind: "CONTENT_GAP",
          gapReason: "No factory lesson exists for this course, grade and unit.",
          studentLabel: "No approved lesson for this period yet - teacher-led session",
          generationOrder: generationOrder(grade, slot, course, unit),
          stemPractices: PRACTICES[COURSE_FAMILY[course].family],
        },
      };
    }
    if (slot === "SUPPORT" || slot === "END_OF_DAY") return { slot, start, end, binding: { kind: "CONTENT_GAP", gapReason: "No factory activity exists yet.", studentLabel: slot === "SUPPORT" ? "Support time (teacher-led)" : "No approved lesson for this period yet - teacher-led session", generationOrder: supportOrder(grade, slot) } };
    if (slot === "ASSEMBLY") return { slot, start, end, binding: { kind: "TEACHER_LED", activity: "Whole-school assembly with the STEM question of the day.", studentLabel: "Assembly (teacher-led)" } };
    return { slot, start, end, binding: { kind: "NON_INSTRUCTIONAL" } };
  });
  return {
    planVersion: "stem-day-plan/1.0.0",
    planId: `stem1-${grade === 0 ? "k" : `g${grade}`}-day1`,
    grade,
    section: "A",
    sectionB: { rotation: `section B takes section A's period i+${SECTION_B_OFFSET}`, order: sectionBOrder(order) },
    timetableMode: "STANDARD_45",
    generatedFrom: "scripts/cos-stem/lib/days.cjs (band template); do not edit by hand",
    scope: "Full K-12 STEM day (founder, 2026-10-23). Every instructional period must be bound to a factory lesson that passes G1-G8 before this grade's day can be called complete.",
    developmentalBand: developmentalBand(grade),
    blocks,
  };
}

module.exports = { BELL, TEACHING, dayCourses, sectionBOrder, SECTION_B_OFFSET, buildGeneratedPlan, generationOrder, supportOrder, PRACTICES };
