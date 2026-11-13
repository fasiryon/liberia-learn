/**
 * STEM Excellence Program: instructional standards the CoS audits against (G3) and the factory generates to.
 *
 * Owner: Chief of Staff (program standard). This file is the CONTRACT. It is not runtime code:
 *  - the Content Factory (T2) generates lessons that satisfy it;
 *  - the Student Experience owner (T1) implements the Computing and Engineering patterns as an additive
 *    `liberialearn-v4-instruction/1.1.0` and the proposed blocks in the teaching-block registry;
 *  - scripts/cos-stem/g3-audit.cjs checks generated packages against it.
 * Developmental bands follow the founder's K-2 / 3-5 / 6-8 / 9-12 grouping.
 */

/** Teaching patterns. MATHEMATICS/SCIENCE/HUMANITIES/LANGUAGE restate V4 1.0.0; COMPUTING and ENGINEERING are new. */
const PATTERNS = {
  MATHEMATICS: ["VISUALIZE", "DEMONSTRATE", "SOLVE_WITH_SUPPORT", "PRACTICE_INDEPENDENTLY", "ANALYZE_MISTAKE", "APPLY"],
  SCIENCE: ["PREDICT", "EXPERIMENT", "OBSERVE", "EXPLAIN", "APPLY"],
  HUMANITIES: ["EXPLORE", "INVESTIGATE", "COMPARE", "REASON", "APPLY"],
  LANGUAGE: ["READ", "UNDERSTAND", "ANALYZE", "CONSTRUCT", "REVISE"],
  // T2 proposed ALGORITHM > TRACE > IMPLEMENT > TEST > DEBUG (T2-STEM-K12-ACK.md); reconciled here: TEST added, and the
  // guided/independent split is kept because V4 independence rules need it. ALGORITHM = DECOMPOSE + DEMONSTRATE (worked
  // trace), IMPLEMENT = BUILD_WITH_SUPPORT + BUILD_INDEPENDENTLY.
  COMPUTING: ["PREDICT", "DECOMPOSE", "DEMONSTRATE", "BUILD_WITH_SUPPORT", "BUILD_INDEPENDENTLY", "TEST", "DEBUG", "APPLY"],
  // T2 proposed DEFINE > DESIGN > BUILD > TEST > IMPROVE; covered here (IMPROVE = REFINE), plus constraints research and communication.
  ENGINEERING: ["DEFINE", "RESEARCH_CONSTRAINTS", "DESIGN", "BUILD_OR_MODEL", "TEST", "REFINE", "COMMUNICATE"],
};

/** Program course -> teaching family and the subject code a package must record. */
const COURSE_FAMILY = {
  MATH: { family: "MATHEMATICS", recordedSubjects: ["MATH"] },
  SCIENCE: { family: "SCIENCE", recordedSubjects: ["SCIENCE"] },
  BIOLOGY: { family: "SCIENCE", recordedSubjects: ["SCIENCE", "BIOLOGY"] },
  CHEMISTRY: { family: "SCIENCE", recordedSubjects: ["SCIENCE", "CHEMISTRY"] },
  PHYSICS: { family: "SCIENCE", recordedSubjects: ["SCIENCE", "PHYSICS"] },
  COMPUTING: { family: "COMPUTING", recordedSubjects: ["COMPUTER_SCIENCE"] },
  ENGINEERING: { family: "ENGINEERING", recordedSubjects: ["ENGINEERING_FOUNDATIONS"] },
  ENGLISH: { family: "LANGUAGE", recordedSubjects: ["ENGLISH", "LITERACY"] },
  SOCIAL_STUDIES: { family: "HUMANITIES", recordedSubjects: ["SOCIAL_STUDIES", "CIVICS", "HISTORY"] },
  CIVICS: { family: "HUMANITIES", recordedSubjects: ["CIVICS"] },
};

/**
 * Computing and Engineering competencies by developmental band: what a lesson in that band must make the
 * learner DO, and the evidence it must leave. A lesson that only describes these is not a Computing or
 * Engineering lesson.
 */
const COMPUTING = {
  "K-2": {
    medium: "UNPLUGGED_AND_GRID",
    learnerDoes: ["Give and follow exact step-by-step instructions", "Program a floor or screen grid robot with arrow commands", "Spot a repeating pattern and replace it with one repeat", "Find and fix one wrong step"],
    evidence: ["A sequence the learner built", "A bug the learner found and fixed"],
    blocks: { now: ["SEQUENCE", "SORT", "CHECK"], needed: ["GRID_ROBOT_PROGRAM", "AUDIO_PROMPT"] },
  },
  "3-5": {
    medium: "BLOCKS",
    learnerDoes: ["Write a program with sequence, loops and conditionals", "Name a procedure and reuse it", "Trace a program step by step", "Debug a logic error and explain it", "Collect data and represent it"],
    evidence: ["A working program or a full trace table", "A debugged error with explanation", "A test the learner chose"],
    blocks: { now: ["SEQUENCE", "MISTAKE_ANALYSIS", "NUMERIC_RESPONSE", "DATA_PLOT"], needed: ["BLOCK_PROGRAM", "GRID_ROBOT_PROGRAM"] },
  },
  "6-8": {
    medium: "TEXT_CODE_INTRO",
    learnerDoes: ["Design an algorithm with a flowchart or pseudocode", "Write text code with variables, conditionals, loops and functions", "Trace with a trace table including boundary cases", "Write tests including edge cases", "Debug with evidence", "Analyse a dataset"],
    evidence: ["Code or pseudocode with tests", "A trace table", "A corrected bug with the failing test"],
    blocks: { now: ["MISTAKE_ANALYSIS", "NUMERIC_RESPONSE", "WRITING_ORGANIZER", "DATA_PLOT"], needed: ["CODE_TRACE", "CODE_RUNNER"] },
  },
  "9-12": {
    medium: "TEXT_CODE",
    learnerDoes: ["Decompose a real problem into functions and data structures", "Implement and test a solution to a specification", "Compare algorithm efficiency with evidence", "Reason about security, privacy and fairness of a system", "Work with data: clean, analyse, visualise, conclude"],
    evidence: ["Tested code against a specification", "An efficiency or correctness argument", "A written evaluation of limits and risks"],
    blocks: { now: ["MISTAKE_ANALYSIS", "WRITING_ORGANIZER", "DATA_PLOT"], needed: ["CODE_TRACE", "CODE_RUNNER"] },
  },
};

const ENGINEERING = {
  "K-2": {
    medium: "MAKE_AND_TEST",
    learnerDoes: ["Build something from local materials for a stated need", "Test it in a simple, safe way", "Say what worked and change one thing"],
    evidence: ["A drawing or photo-description of the design", "What happened in the test", "One change and why"],
    blocks: { now: ["SEQUENCE", "CHECK", "SORT"], needed: ["DESIGN_CYCLE", "OBSERVATION_LOG", "AUDIO_PROMPT"] },
  },
  "3-5": {
    medium: "DESIGN_CYCLE_WITH_MEASUREMENT",
    learnerDoes: ["State criteria and constraints before building", "Make two designs", "Run a fair test and record measurements", "Improve the design using the data"],
    evidence: ["Criteria and constraints", "A measurement table", "A data-based improvement"],
    blocks: { now: ["DATA_PLOT", "NUMERIC_RESPONSE", "WRITING_ORGANIZER", "SHAPE_MODEL"], needed: ["DESIGN_CYCLE", "MEASUREMENT_TABLE"] },
  },
  "6-8": {
    medium: "STRUCTURED_ENGINEERING",
    learnerDoes: ["Write a design brief with measurable criteria, constraints and a budget", "Use mathematics or science to predict performance", "Prototype or model, test against criteria, and record data", "Iterate at least once and justify trade-offs"],
    evidence: ["A design brief", "A prediction from a model or calculation", "Test data against criteria", "A justified trade-off"],
    blocks: { now: ["DATA_PLOT", "NUMERIC_RESPONSE", "WORKED_SOLUTION", "WRITING_ORGANIZER", "SHAPE_MODEL"], needed: ["DESIGN_CYCLE", "MEASUREMENT_TABLE", "BUDGET_CONSTRAINT_TABLE"] },
  },
  "9-12": {
    medium: "ENGINEERING_DESIGN_AND_ANALYSIS",
    learnerDoes: ["Specify requirements for a real Liberian problem", "Analyse with quantitative models (forces, circuits, flow, energy)", "Evaluate alternatives with a decision matrix", "Test, analyse failure, and document the design"],
    evidence: ["Requirements", "A quantitative analysis", "A decision matrix", "A test and failure analysis"],
    blocks: { now: ["EQUATION", "WORKED_SOLUTION", "NUMERIC_RESPONSE", "DATA_PLOT", "WRITING_ORGANIZER"], needed: ["DESIGN_CYCLE", "MEASUREMENT_TABLE", "BUDGET_CONSTRAINT_TABLE"] },
  },
};

/** How lessons must be shaped for each developmental band (founder item 8). */
const DEVELOPMENTAL = {
  // maxSentenceWords / maxSceneBodyWords bound the reading load of learner-visible scene text.
  "K-2": { maxSentenceWords: 10, maxSceneBodyWords: 50, approach: "Play, stories, counting, observation and hands-on exploration", maxSegmentMinutes: 10, maxScreenMinutesPerPeriod: 15, readAloudRequired: true, independentWritingWords: [0, 15], requiresMovementSegment: true },
  "3-5": { maxSentenceWords: 16, maxSceneBodyWords: 90, approach: "Conceptual foundations, guided investigations and foundational computing", maxSegmentMinutes: 15, maxScreenMinutesPerPeriod: 25, readAloudRequired: false, independentWritingWords: [20, 80], requiresMovementSegment: false },
  "6-8": { maxSentenceWords: 24, maxSceneBodyWords: 130, approach: "Formal reasoning, laboratory investigation, coding and structured engineering", maxSegmentMinutes: 20, maxScreenMinutesPerPeriod: 35, readAloudRequired: false, independentWritingWords: [60, 200], requiresMovementSegment: false },
  "9-12": { maxSentenceWords: 32, maxSceneBodyWords: 150, approach: "Advanced mathematics and sciences, programming, engineering design, research and career preparation", maxSegmentMinutes: 25, maxScreenMinutesPerPeriod: 40, readAloudRequired: false, independentWritingWords: [120, 400], requiresMovementSegment: false },
};

const developmentalBand = (grade) => (grade <= 2 ? "K-2" : grade <= 5 ? "3-5" : grade <= 8 ? "6-8" : "9-12");

/**
 * Instructional progression (founder, 2026-10-23): every lesson, and every day, moves the learner through
 * a new idea, investigation, practice, meaningful application and feedback that helps them improve.
 * Phases from every family pattern map onto those five moves; FEEDBACK is also satisfied by blocks that
 * give learner-specific feedback after an attempt.
 */
const PROGRESSION = {
  NEW_IDEA: ["VISUALIZE", "PREDICT", "READ", "EXPLORE", "DEFINE", "DECOMPOSE"],
  INVESTIGATE: ["EXPERIMENT", "INVESTIGATE", "UNDERSTAND", "RESEARCH_CONSTRAINTS", "DEMONSTRATE", "EXPLAIN"],
  // OBSERVE is the science pattern's practice phase: the learner interprets data on their own (both V4 batches use it so).
  PRACTISE: ["SOLVE_WITH_SUPPORT", "PRACTICE_INDEPENDENTLY", "OBSERVE", "BUILD_WITH_SUPPORT", "BUILD_INDEPENDENTLY", "ANALYZE", "COMPARE", "BUILD_OR_MODEL"],
  APPLY: ["APPLY", "CONSTRUCT", "REASON", "DESIGN", "COMMUNICATE"],
  FEEDBACK: ["ANALYZE_MISTAKE", "REVISE", "DEBUG", "TEST", "REFINE"],
};
const FEEDBACK_BLOCKS = ["CHECK", "NUMERIC_RESPONSE", "MISTAKE_ANALYSIS", "FRACTION_NUMBER_LINE", "FRACTION_COMPARE", "SORT", "SEQUENCE", "SOURCE_EVIDENCE", "PREDICT_OBSERVE", "DIGIT_CARDS", "SENTENCE_BUILDER", "MAP_EXPLORER", "AREA_MODEL"];

/**
 * STEM rigor rises with grade (founder example: K floats and sinks; G6 measures water use and graphs it;
 * G12 analyses real data, writes code, tests a model and defends an engineering solution). These are the
 * minimum observable signals a STEM lesson (Math, Science, Computing, Engineering) must show in its band.
 * Signals are mechanical; G4 judges whether the rigor is real.
 */
// Per lesson: data is required by the families named in dataFor, a model or code by modelOrCodeFor.
// Per day (dayNeeds): the day as a whole must show these, so a fractions lesson need not carry a graph,
// but a Grade 6-8 day without any data work fails.
const RIGOR = {
  "K-2": { expects: "Observe, sort, count, build and tell", minQuantitativeTasks: 0, dataFor: [], modelOrCodeFor: [], requiresJustification: false, dayNeeds: [] },
  "3-5": { expects: "Measure, compare, record in tables, explain with evidence", minQuantitativeTasks: 1, dataFor: [], modelOrCodeFor: [], requiresJustification: true, dayNeeds: ["data"] },
  "6-8": { expects: "Measure and graph, reason formally, trace and test code, design to criteria", minQuantitativeTasks: 2, dataFor: ["SCIENCE", "ENGINEERING"], modelOrCodeFor: ["COMPUTING"], requiresJustification: true, dayNeeds: ["data", "modelOrCode"] },
  "9-12": { expects: "Analyse real data, write and test code or models, defend a solution quantitatively", minQuantitativeTasks: 3, dataFor: ["SCIENCE", "ENGINEERING", "COMPUTING"], modelOrCodeFor: ["MATHEMATICS", "SCIENCE", "COMPUTING", "ENGINEERING"], requiresJustification: true, dayNeeds: ["data", "modelOrCode"] },
};

/**
 * G3 academic QA checks (CoS). Each is mechanical evidence of a teaching defect; passing them all is
 * necessary but not sufficient. G4 qualified human review still decides academic quality.
 */
const G3_CHECKS = [
  { code: "MOJIBAKE", severity: "BLOCKING", what: "Mis-decoded characters (e.g. â€”) in learner-visible text" },
  { code: "LEARNER_SEES_POLICY_TEXT", severity: "MAJOR", what: "System, policy or answer-policy text shown to learners instead of teaching" },
  { code: "TEMPLATE_BODY", severity: "MAJOR", what: "A scene body that is generic template text, not lesson-specific" },
  { code: "TITLE_PREFIX", severity: "MINOR", what: "Learner-facing title carries a generator prefix" },
  { code: "SINGLE_MISCONCEPTION", severity: "MAJOR", what: "Fewer than two distinct misconceptions taught against and diagnosed" },
  { code: "NO_HINTS_IN_GUIDED", severity: "MAJOR", what: "A guided (supported) scene gives no hint before the learner answers" },
  { code: "TWO_OPTION_CHECKS", severity: "MAJOR", what: "Most choice items have only two options (50% guessing)" },
  { code: "GENERIC_LEARNER_ACTION", severity: "MAJOR", what: "The learner action does not say what to do in this lesson" },
  { code: "SUBJECT_RECORDED_WRONG", severity: "MAJOR", what: "Recorded subject does not match the course (e.g. Computing recorded as SCIENCE)" },
  { code: "PATTERN_MISMATCH", severity: "MAJOR", what: "Scene phases do not follow the course family's teaching pattern" },
  { code: "UNUSED_AVAILABLE_SIMULATION", severity: "MAJOR", what: "A science lesson on a topic with a registered simulation block does not use it" },
  { code: "DEVELOPMENTAL_MISMATCH", severity: "MAJOR", what: "Age-inappropriate instruction: reading load or writing demand does not fit the developmental band" },
  { code: "ROLE_CONTRACT_UNMET", severity: "MAJOR", what: "A differentiated-support or end-of-day activity does not meet its role contract (ROLE_CONTRACTS)" },
  { code: "WEAK_REASONING", severity: "MAJOR", what: "Fewer than two tasks ask the learner to explain, justify or defend their thinking" },
  { code: "GUIDED_WITHOUT_FEEDBACK", severity: "MAJOR", what: "A guided scene gives the learner no feedback on their own attempt" },
  { code: "PROGRESSION_INCOMPLETE", severity: "MAJOR", what: "The lesson skips one of: new idea, investigation, practice, application, feedback" },
  { code: "TEMPLATE_STRUCTURE", severity: "MAJOR", what: "The lesson has the same phase sequence and block set as lessons in other courses: one generic template, not subject-specific teaching" },
  { code: "RIGOR_BELOW_BAND", severity: "MAJOR", what: "A STEM lesson lacks the quantitative, data, model/code or justification demands its grade band requires" },
];

/**
 * Role contracts for activities that serve the whole day rather than one course (CoS ruling 2026-10-23 on
 * T2-SUPPORT-INTAKE-PREFLIGHT.md). They carry no course, so no course subject or family pattern applies;
 * the recorded subject may be any subject of that grade's day. Each check is mechanical evidence only.
 */
const sceneText = (s) => `${s.title ?? ""} ${s.content?.body ?? ""} ${s.learnerAction ?? ""}`;
const hasHint = (s) => (s.hints ?? []).length > 0;
const phases = (c) => c.scenes.map((s) => s.teaching?.phase).filter(Boolean);
const ROLE_CONTRACTS = {
  DIFFERENTIATED_SUPPORT: {
    requiredMoves: ["PRACTISE", "FEEDBACK", "APPLY"],
    checks: [
      { what: "an independent retrieval scene with no hints (shows what the learner can do alone)", test: (c) => c.scenes.some((s) => ["PRACTICE_INDEPENDENTLY", "RETRIEVE", "BUILD_INDEPENDENTLY", "OBSERVE"].includes(s.teaching?.phase) && !hasHint(s)) },
      { what: "a guided re-teach scene with hints", test: (c) => c.scenes.some((s) => ["SOLVE_WITH_SUPPORT", "BUILD_WITH_SUPPORT", "DEMONSTRATE", "UNDERSTAND", "INVESTIGATE"].includes(s.teaching?.phase) && hasHint(s)) },
      { what: "an extension path beyond the day's objectives", test: (c) => c.scenes.some((s) => /extend|extension|challenge|go further/i.test(sceneText(s))) || phases(c).includes("APPLY") },
    ],
  },
  END_OF_DAY_REFLECTION: {
    requiredMoves: ["APPLY"],
    checks: [
      { what: "a reflection prompt about what the learner learned or how their thinking changed", test: (c) => c.scenes.some((s) => /reflect|what (did|have) you learn|changed? (in )?your thinking|today|one question/i.test(sceneText(s))) },
      { what: "a connection across the day's periods", test: (c) => c.scenes.some((s) => /connect|link|across|between|period|today's/i.test(sceneText(s))) },
    ],
  },
};

module.exports = { ROLE_CONTRACTS, PATTERNS, COURSE_FAMILY, COMPUTING, ENGINEERING, DEVELOPMENTAL, developmentalBand, G3_CHECKS, PROGRESSION, FEEDBACK_BLOCKS, RIGOR };
