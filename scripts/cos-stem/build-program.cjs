#!/usr/bin/env node
/**
 * STEM Excellence Program V1 builder and validator (Chief of Staff).
 *
 *   node scripts/cos-stem/build-program.cjs          regenerate outputs
 *   node scripts/cos-stem/build-program.cjs --check  fail if outputs are stale or any day plan is invalid
 *
 * Inputs (read-only): the course catalog source, the draft.6 pins, the day plans, and the live-catalog
 * inventory captured read-only on 2026-10-16 (curriculum/modernization/v1/inventory.json).
 * Outputs: curriculum/program/stem-v1/{course-catalog,coverage-matrix,production-orders}.json and
 * docs/program/STEM_COVERAGE_MATRIX_V1.md. No database, network or lesson generation.
 *
 * The validator enforces two founder rules mechanically: an empty period is never disguised (every
 * slot is bound to an exact draft hash, an explicit CONTENT_GAP with a full production order, a
 * labelled teacher-led activity, or a non-instructional block), and nothing unapproved is labelled
 * as approved or official.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const P = (...p) => path.join(ROOT, ...p);
const PROGRAM = P("curriculum/program/stem-v1");
const { buildCourses, WEEKLY, BLOCKS, STANDARD_WEEK_PERIODS } = require(path.join(PROGRAM, "source/courses.cjs"));
const pins = JSON.parse(fs.readFileSync(path.join(PROGRAM, "source/draft6-pins.json"), "utf8"));
const schoolday = JSON.parse(fs.readFileSync(path.join(PROGRAM, "source/schoolday-pins.json"), "utf8"));
const standards = require(path.join(PROGRAM, "source/standards.cjs"));
const days = require("./lib/days.cjs");
const simulate = require("./lib/simulate.cjs");
const pinRegistry = require("./lib/pins.cjs");
const REVIEW_DIR = path.join(PROGRAM, "reviews");
const RELEASE_EVIDENCE = path.join(PROGRAM, "source/release-evidence.json");
const g3 = JSON.parse(fs.readFileSync(path.join(PROGRAM, "g3-audit.json"), "utf8"));
const inventory = JSON.parse(fs.readFileSync(P("curriculum/modernization/v1/inventory.json"), "utf8"));
const REGISTRY_SRC = fs.readFileSync(P("lib/learner-experience/teaching/registry.ts"), "utf8");
const LAB_SRC = fs.readFileSync(P("lib/labs/registry.ts"), "utf8");

const STEM_PRACTICES = [
  "CONCEPT_BEFORE_PROCEDURE",
  "MATHEMATICAL_REASONING",
  "SCIENTIFIC_EVIDENCE",
  "ENGINEERING_DESIGN",
  "COMPUTATIONAL_THINKING",
  "COMMUNICATION_AND_CRITICAL_THINKING",
  "LIBERIAN_APPLICATION",
  "PRACTICE_CONTINUUM",
];
const CONTINUUM = ["GUIDED", "INDEPENDENT", "EXTENSION", "REFLECTION"];
const FAILING_OUTCOMES = new Set(["REVISE", "REBUILD_REQUIRED", "BLOCKED_SOURCE_OR_AUTHORITY"]);
const WEEKS_PER_YEAR = 36;
const PILOT_WEEKS = 2;

const existingBlocks = new Set([...REGISTRY_SRC.matchAll(/^ {2}([A-Z_]+): z\.strictObject/gm)].map((m) => m[1]));
const registeredLabs = new Set([...LAB_SRC.matchAll(/^\s+id: "([a-z-]+)"/gm)].map((m) => m[1]));
const proposedBlocks = new Set(Object.values(BLOCKS).flatMap((bands) => Object.values(bands).flatMap((b) => b.proposed)));

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

// ---------- course catalog ----------
const courses = buildCourses();
for (const [band, alloc] of Object.entries(WEEKLY)) {
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);
  if (total !== STANDARD_WEEK_PERIODS) fail(`WEEKLY ${band}`, `allocates ${total} periods, expected ${STANDARD_WEEK_PERIODS}`);
}
for (const c of courses) {
  for (const b of c.blocks.existing) if (!existingBlocks.has(b)) fail(c.courseId, `block ${b} is listed as existing but is not in the teaching-block registry`);
  for (const b of c.blocks.proposed) if (existingBlocks.has(b)) fail(c.courseId, `block ${b} already exists; move it to existing`);
  for (const lab of c.labs) if (!registeredLabs.has(lab)) fail(c.courseId, `lab ${lab} is not in lib/labs/registry.ts`);
}

// ---------- coverage matrix ----------
const lessons = inventory.lessons;
const batches = pinRegistry.loadBatches(PROGRAM);
const drafts = pinRegistry.loadPackages(PROGRAM);
const track = (l) => l.classification.track.charAt(0);
function liveFor(course) {
  const subjects = new Set(course.inventorySubjects);
  if (course.course === "SOCIAL_STUDIES" && course.grade <= 5) subjects.add("CIVICS"); // K-5 civics is taught inside Social Studies.
  return lessons.filter((l) => l.grade === course.grade && subjects.has(l.subject));
}

const matrix = courses.map((c) => {
  const live = c.platformDelivered ? liveFor(c) : [];
  const byTrack = { A: 0, B: 0, C: 0, D: 0 };
  for (const l of live) byTrack[track(l)] += 1;
  const verifiedUsable = live.filter((l) => !FAILING_OUTCOMES.has(l.audit.reviewOutcome)).length;
  const v4Drafts = drafts.filter((d) => d.grade === c.grade && d.course === c.course).map((d) => d.key);
  const otherCandidates = live.filter((l) => l.modernization.candidate).map((l) => l.modernization.candidate);
  let status;
  if (!c.platformDelivered) status = "TEACHER_LED";
  else if (verifiedUsable > 0) status = "USABLE_APPROVED";
  else if (v4Drafts.length) status = "V4_DRAFT_IN_REVIEW";
  else if (otherCandidates.length) status = "CANDIDATE_IN_REVIEW";
  else if (live.length === 0) status = "MISSING_NO_CONTENT";
  else if (byTrack.A + byTrack.B === 0) status = "MISSING_HELD_ONLY";
  else status = "MODERNIZE_EXISTING";
  const yearLessonTarget = c.platformDelivered ? Math.max(0, c.weeklyPeriods * WEEKS_PER_YEAR - c.units.length * 2) : 0;
  return {
    courseId: c.courseId,
    grade: c.grade,
    gradeLabel: c.gradeLabel,
    band: c.band,
    course: c.course,
    subject: c.subject,
    pillar: c.pillar,
    weeklyPeriods: c.weeklyPeriods,
    units: c.units.length,
    live: { total: live.length, byTrack, sharedWithStrands: ["BIOLOGY", "CHEMISTRY", "PHYSICS"].includes(c.course) },
    verifiedUsable,
    v4Drafts,
    otherCandidates,
    status,
    requiredBlocks: c.blocks,
    labs: c.labs,
    targets: { pilotWindowLessons: c.platformDelivered ? c.weeklyPeriods * PILOT_WEEKS : 0, yearLessons: yearLessonTarget },
    release: !c.platformDelivered
      ? "teacher-led; not platform curriculum"
      : !v4Drafts.length
        ? "no approved lesson version; program gates G1-G8 not started"
        : [
            ...batches.filter((b) => b.packages.some((p) => p.grade === c.grade && p.course === c.course)).map((b) => `${b.version} ${b.state}${b.commit ? ` @${b.commit}` : ""}${b.hold ? " (HELD by T2)" : ""}`),
            "human subject-expert review NOT_PERFORMED; learning-preview flag OFF; no release",
          ].join("; "),
    dayPlanPeriods: [],
  };
});
const matrixById = new Map(matrix.map((m) => [m.courseId, m]));

// ---------- day plans ----------
const planDir = process.env.STEM_PLAN_DIR ? path.resolve(process.env.STEM_PLAN_DIR) : path.join(PROGRAM, "day-plans");
// Hand-authored plans are read from disk; every other grade is generated from its band template (and written as an output).
const handPlans = fs.readdirSync(planDir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ file: f, plan: JSON.parse(fs.readFileSync(path.join(planDir, f), "utf8")) }))
  .filter(({ plan }) => !plan.generatedFrom);
const generatedPlans = [];
for (let grade = 0; grade <= 12; grade++) {
  if (handPlans.some(({ plan }) => plan.grade === grade)) continue;
  const plan = days.buildGeneratedPlan(grade, courses);
  generatedPlans.push({ file: `g${grade}-day1.json`, plan });
}
const plans = [...handPlans, ...generatedPlans].sort((a, b) => a.plan.grade - b.plan.grade);

// Automatic coverage: a pinned factory package that names a generation order fills that order's slot.
// Only exact pinned packages bind; a course outline or an order never counts as a lesson.
//
// Replacement orders (CoS ruling, 2026-10-23, on T2-K12-EXECUTION-DETAILS.md): a slot held by an interim lesson
// that can never reach ACADEMICALLY_REVIEWED (immutable draft.6, or a batch held by T2) gets an explicit order
// for the same course and unit. The interim binding stays until a replacement package passes; draft.6 bytes
// are never edited, and draft.6 stays in its separate admission registry exactly as the founder directed.
const INTERIM = { V4_DRAFT: "4.0.0-draft.6 (immutable; cannot be repaired in place)", SCHOOLDAY_DRAFT: "4.0.0-schoolday.1-draft.2 (held by T2 for S1-S4)" };
for (const { plan } of plans) {
  for (const block of plan.blocks) {
    const b = block.binding;
    if (!INTERIM[b?.kind] || !block.course) continue;
    const c = courses.find((x) => x.grade === plan.grade && x.course === block.course);
    const u = c?.units.find((x) => x.unit === block.unit);
    if (!u) continue; // reported by validation
    const order = days.generationOrder(plan.grade, block.slot, block.course, { ...u, courseId: c.courseId, blocks: c.blocks, labs: c.labs });
    const replaces = `${b.version ?? "4.0.0-draft.6"}@${b.key}`;
    b.replacementOrder = {
      ...order,
      orderId: `${order.orderId}-R`,
      replaces,
      replacementReason: `interim binding ${INTERIM[b.kind]} cannot reach ACADEMICALLY_REVIEWED`,
      requirements: [...order.requirements, `Resolve every G3 finding recorded for ${replaces} in curriculum/program/stem-v1/g3-audit.json; keep what that lesson does well`, ...(b.requiresAttachment ? [`Keep the required attachment: ${b.requiresAttachment}`] : [])],
    };
  }
}

const autoBound = [];
for (const { plan } of plans) {
  for (const block of plan.blocks) {
    const b = block.binding;
    const order = b?.kind === "CONTENT_GAP" ? (b.generationOrder ?? b.productionOrder) : INTERIM[b?.kind] ? b.replacementOrder : null;
    if (!order) continue;
    // The current holder is the package for this order that no other pinned package supersedes (explicit supersession only).
    const holders = drafts.filter((d) => d.orderId === order.orderId && !drafts.some((q) => q.supersedes === `${d.version}@${d.key}`));
    if (holders.length > 1) fail(`${plan.planId} ${block.slot}`, `order ${order.orderId} has ${holders.length} current packages; supersession must be explicit`);
    const pkg = holders[0];
    if (!pkg) continue;
    block.binding = {
      kind: "FACTORY_LESSON",
      key: pkg.key,
      version: pkg.version,
      selection: `factory@${pkg.version}@${pkg.key}`,
      packageHash: pkg.packageHash,
      candidateSha256: pkg.candidateSha256,
      orderId: order.orderId,
      officialStatus: "NOT_APPROVED",
      studentLabel: "Pilot draft lesson (not yet approved) - ungraded",
      title: pkg.title,
      phases: pkg.phases,
      timing: "UNMEASURED_G6",
      stemPractices: order.stemPractices ?? b.stemPractices ?? [],
      generationOrder: order, // kept so the backlog records the order as FULFILLED rather than losing it
    };
    autoBound.push({ grade: plan.grade, slot: block.slot, orderId: order.orderId, key: pkg.key, version: pkg.version, replaced: order.replaces ?? null });
  }
}
const orders = [];
const generationOrders = [];
const FORBIDDEN_LABEL = /\b(approved|official)\b/i;
const minutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

for (const { file, plan } of plans) {
  const where = `day-plans/${file}`;
  const practices = new Set();
  const pillars = new Set();
  const perCourse = {};
  let previousEnd = null;
  for (const block of plan.blocks) {
    const at = `${where} ${block.slot}`;
    const b = block.binding;
    if (!b || !b.kind) { fail(at, "has no binding"); continue; }
    if (previousEnd && block.start !== previousEnd) fail(at, `starts ${block.start}, previous block ended ${previousEnd}`);
    previousEnd = block.end;
    const length = minutes(block.end) - minutes(block.start);
    if (b.kind === "NON_INSTRUCTIONAL") continue;
    if (b.kind === "TEACHER_LED") { if (!b.studentLabel || !/teacher-led/i.test(b.studentLabel)) fail(at, "teacher-led block must say so in studentLabel"); continue; }
    if (!b.studentLabel) fail(at, "missing studentLabel");
    if (b.kind === "V4_DRAFT" || b.kind === "SCHOOLDAY_DRAFT" || b.kind === "FACTORY_LESSON") {
      if (!/not yet approved/i.test(b.studentLabel)) fail(at, "draft label must say 'not yet approved'");
    } else if (b.studentLabel && FORBIDDEN_LABEL.test(b.studentLabel) && !/no approved lesson/i.test(b.studentLabel)) {
      fail(at, `label implies approval: "${b.studentLabel}"`);
    }
    const course = block.course ? courses.find((c) => c.grade === plan.grade && c.course === block.course) : null;
    if (block.slot.startsWith("P")) {
      if (!course) { fail(at, `course ${block.course} is not in the grade ${plan.grade} catalog`); continue; }
      if (!course.units.find((u) => u.unit === block.unit)) fail(at, `unit ${block.unit} not in ${course.courseId}`);
      perCourse[block.course] = (perCourse[block.course] ?? 0) + 1;
      pillars.add(course.pillar);
      if (length !== 50) fail(at, `teaching slot is ${length} min; STANDARD_45 expects 45 + 5 transition`);
    }
    (b.stemPractices ?? []).forEach((p) => { if (!STEM_PRACTICES.includes(p)) fail(at, `unknown practice ${p}`); practices.add(p); });
    const expected = block.slot.startsWith("P") ? 45 : length;
    if (INTERIM[b.kind] && b.replacementOrder) generationOrders.push({ planId: plan.planId, slot: block.slot, grade: plan.grade, ...b.replacementOrder, status: "OPEN" });
    if (b.kind === "V4_DRAFT") {
      const pin = drafts.find((d) => d.key === b.key);
      if (!pin) { fail(at, `draft ${b.key} is not pinned`); continue; }
      if (b.packageHash !== pin.packageHash) fail(at, "packageHash does not match the sealed draft.6 pin");
      if (b.candidateSha256 !== pin.candidateSha256) fail(at, "candidateSha256 does not match the sealed draft.6 pin");
      if (b.selection !== `factory@${pins.version}@${b.key}`) fail(at, "selection grammar must be factory@4.0.0-draft.6@<key>");
      if (b.officialStatus !== "NOT_APPROVED") fail(at, "draft periods must carry officialStatus NOT_APPROVED");
      if (pin.grade !== plan.grade || pin.course !== block.course || pin.unit !== block.unit) fail(at, "draft is bound to the wrong grade, course or unit");
      const sum = b.sequence.reduce((a, s) => a + s.minutes, 0);
      if (sum !== expected) fail(at, `sequence sums to ${sum} min, expected ${expected}`);
    } else if (b.kind === "SCHOOLDAY_DRAFT") {
      const pin = schoolday.packages.find((d) => d.key === b.key);
      if (!pin) { fail(at, `schoolday lesson ${b.key} is not pinned`); continue; }
      if (b.version !== schoolday.version || b.selection !== `factory@${schoolday.version}@${b.key}`) fail(at, "schoolday selection must name the pinned version");
      if (b.packageHash !== pin.packageHash || b.candidateSha256 !== pin.candidateSha256) fail(at, "hash does not match the schoolday pin");
      if (b.officialStatus !== "NOT_APPROVED" || !/not yet approved/i.test(b.studentLabel ?? "")) fail(at, "schoolday draft must be NOT_APPROVED and labelled so");
      if (pin.grade !== plan.grade || pin.course !== block.course || pin.unit !== block.unit) fail(at, "schoolday lesson bound to the wrong grade, course or unit");
      if (!b.provisional) fail(at, "uncommitted schoolday drafts must say they are provisional");
      if (b.timing !== "UNMEASURED_G6") fail(at, "schoolday timing is unmeasured until gate G6");
      if (!(b.phases ?? []).length) fail(at, "schoolday binding needs the lesson's phases");
    } else if (b.kind === "FACTORY_LESSON") {
      const pin = drafts.find((d) => d.version === b.version && d.key === b.key);
      if (!pin) { fail(at, `factory lesson ${b.version}@${b.key} is not pinned`); continue; }
      if (pin.orderId !== b.orderId) fail(at, "factory lesson must fill the order it was generated for");
      if (b.packageHash !== pin.packageHash || b.candidateSha256 !== pin.candidateSha256) fail(at, "hash does not match the batch pin");
      if (block.course && (pin.grade !== plan.grade || pin.course !== block.course || pin.unit !== block.unit)) fail(at, "factory lesson bound to the wrong grade, course or unit");
      if (!block.course && pin.grade !== plan.grade) fail(at, "support or end-of-day activity bound to the wrong grade");
      if (b.generationOrder) generationOrders.push({ planId: plan.planId, slot: block.slot, grade: plan.grade, ...b.generationOrder, status: "FULFILLED", fulfilledBy: `${b.version}@${b.key}` });
    } else if (b.kind === "CONTENT_GAP") {
      if (!b.gapReason) fail(at, "gap needs a gapReason");
      if (!/no approved lesson|teacher-led/i.test(b.studentLabel ?? "")) fail(at, "gap must be visible to learners as no approved lesson / teacher-led");
      if ("body" in b || "content" in b) fail(at, "a gap must not carry lesson text");
      if (b.generationOrder) {
        const g = b.generationOrder;
        if (!g.orderId || g.owner !== "T2_CODEX" && g.kind === "LESSON") fail(at, "generation order needs an orderId and the T2_CODEX owner");
        if (g.kind === "LESSON") {
          const c = courses.find((x) => x.courseId === g.courseId);
          if (!c || c.grade !== plan.grade || c.course !== block.course) fail(at, `generation order course ${g.courseId} does not match the period`);
          else if (!c.units.find((u) => u.unit === g.unit && u.performanceTask === g.performanceTask)) fail(at, "generation order unit or performance task is not the catalog's");
          const fam = standards.COURSE_FAMILY[block.course];
          if (JSON.stringify(g.pattern) !== JSON.stringify(standards.PATTERNS[fam.family])) fail(at, `generation order pattern must be the ${fam.family} pattern`);
          if (!fam.recordedSubjects.includes(g.recordedSubject)) fail(at, `generation order must record ${fam.recordedSubjects.join("/")}`);
          if (["COMPUTING", "ENGINEERING"].includes(fam.family) && !g.competencies) fail(at, "Computing/Engineering order needs band competencies");
          if ((g.gates ?? []).length !== 8) fail(at, "generation order must name gates G1-G8");
        } else if (!["DIFFERENTIATED_SUPPORT", "END_OF_DAY_REFLECTION"].includes(g.kind)) fail(at, `unknown generation order kind ${g.kind}`);
        else if (!(g.requirements ?? []).length) fail(at, "support order needs requirements");
        generationOrders.push({ planId: plan.planId, slot: block.slot, grade: plan.grade, ...g, status: "OPEN" });
        if (block.course) { const row = matrixById.get(course?.courseId); if (row) row.dayPlanPeriods.push({ planId: plan.planId, slot: block.slot, binding: b.kind, key: g.orderId }); }
        continue;
      }
      const o = b.productionOrder;
      if (!o) { fail(at, "gap needs a productionOrder or a generationOrder"); continue; }
      if (!o.orderId || !o.owner || !o.title) fail(at, "order needs orderId, owner and title");
      if (!matrixById.has(o.courseId)) fail(at, `order course ${o.courseId} is not in the catalog`);
      if ((o.objectives ?? []).length < 2) fail(at, "order needs at least two objectives");
      if ((o.misconceptions ?? []).length < 1) fail(at, "order needs at least one named misconception");
      for (const k of ["evidence", "liberianContext"]) if (!o[k]) fail(at, `order needs ${k}`);
      for (const x of o.blocks.existing) if (!existingBlocks.has(x)) fail(at, `order lists ${x} as existing but it is not registered`);
      for (const x of o.blocks.proposed) if (!proposedBlocks.has(x)) fail(at, `order proposes ${x}, which is not in the catalog's proposed block list`);
      if (o.modernizationSource && !lessons.find((l) => l.contentId === o.modernizationSource)) fail(at, `modernizationSource ${o.modernizationSource} is not in the live inventory`);
      const sum = o.sequence.reduce((a, s) => a + s.minutes, 0);
      if (sum !== expected) fail(at, `order sequence sums to ${sum} min, expected ${expected}`);
      if (block.slot.startsWith("P")) {
        const have = new Set(o.sequence.map((s) => s.practice));
        for (const c of CONTINUUM) if (!have.has(c)) fail(at, `order sequence lacks the ${c} part of the practice continuum`);
      }
      orders.push({ planId: plan.planId, slot: block.slot, grade: plan.grade, ...o });
    } else {
      fail(at, `unknown binding kind ${b.kind}`);
    }
    if (block.course) {
      const row = matrixById.get(course?.courseId);
      if (row) row.dayPlanPeriods.push({ planId: plan.planId, slot: block.slot, binding: b.kind, key: b.key ?? b.productionOrder?.orderId });
    }
  }
  for (const [course, n] of Object.entries(perCourse)) {
    const weekly = WEEKLY[courses.find((c) => c.grade === plan.grade).band][course];
    if (n > Math.ceil(weekly / 5) + 1) fail(where, `${course} has ${n} periods in one day against ${weekly} per week`);
  }
  const orderA = plan.blocks.filter((b) => /^P[1-6]$/.test(b.slot)).map((b) => b.course);
  const orderB = plan.sectionB?.order ?? [];
  if (JSON.stringify(orderB) !== JSON.stringify(days.sectionBOrder(orderA))) fail(where, "sectionB.order must be section A rotated by the program offset");
  orderA.forEach((c, i) => { if (orderB[i] === c) fail(where, `sections A and B both take ${c} in P${i + 1}; one specialist cannot teach both`); });
  for (const pillar of ["S", "T", "E", "M"]) if (!pillars.has(pillar)) fail(where, `day has no ${pillar} period`);
  for (const p of STEM_PRACTICES) if (!practices.has(p)) fail(where, `day never exercises ${p}`);
}

const seenOrders = new Map();
for (const o of [...orders, ...generationOrders]) { if (seenOrders.has(o.orderId)) fail(`${o.planId} ${o.slot}`, `orderId ${o.orderId} already used by ${seenOrders.get(o.orderId)}`); seenOrders.set(o.orderId, `${o.planId} ${o.slot}`); }

// ---------- summaries ----------
const platform = matrix.filter((m) => m.status !== "TEACHER_LED");
const count = (f) => platform.filter(f).length;
const summary = {
  courseGradeCells: matrix.length,
  platformCells: platform.length,
  teacherLedCells: matrix.length - platform.length,
  units: courses.reduce((a, c) => a + c.units.length, 0),
  byStatus: Object.fromEntries([...new Set(matrix.map((m) => m.status))].sort().map((s) => [s, matrix.filter((m) => m.status === s).length])),
  missingCourses: count((m) => m.status.startsWith("MISSING")),
  liveLessonsCatalogued: lessons.length,
  liveVerifiedUsable: lessons.filter((l) => !FAILING_OUTCOMES.has(l.audit.reviewOutcome)).length,
  v4DraftLessons: drafts.length,
  v4DraftsByVersion: Object.fromEntries(batches.map((b) => [b.version, b.packages.length])),
  pilotWindowLessonTarget: platform.reduce((a, m) => a + m.targets.pilotWindowLessons, 0),
  yearLessonTarget: platform.reduce((a, m) => a + m.targets.yearLessons, 0),
  stemShareOfWeek: Object.fromEntries(Object.entries(WEEKLY).map(([band, alloc]) => {
    const stem = Object.entries(alloc).filter(([k]) => ["MATH", "SCIENCE", "BIOLOGY", "CHEMISTRY", "PHYSICS", "COMPUTING", "ENGINEERING"].includes(k)).reduce((a, [, v]) => a + v, 0);
    return [band, `${stem}/${STANDARD_WEEK_PERIODS}`];
  })),
  productionOrders: orders.length,
  generationOrders: { open: generationOrders.filter((o) => o.status === "OPEN").length, fulfilled: generationOrders.filter((o) => o.status === "FULFILLED").length },
};
const reviews = fs.existsSync(REVIEW_DIR) ? fs.readdirSync(REVIEW_DIR, { recursive: true }).filter((f) => String(f).endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(REVIEW_DIR, String(f)), "utf8"))) : [];
const releaseEvidence = JSON.parse(fs.readFileSync(RELEASE_EVIDENCE, "utf8"));
for (const r of reviews) { if (r.humanSubjectExpert !== false && r.reviewerKind !== "HUMAN_SUBJECT_EXPERT") fail(`review ${r.version}@${r.key}`, "a review must say whether a human subject expert performed it"); if (!drafts.find((d) => d.version === r.version && d.key === r.key && d.packageHash === r.packageHash)) fail(`review ${r.version}@${r.key}`, "review is not bound to a pinned package hash"); }
const securityGateFile = path.join(PROGRAM, "security/gate.json");
const securityGate = fs.existsSync(securityGateFile) ? JSON.parse(fs.readFileSync(securityGateFile, "utf8")).snapshots : [];
const riskFile = path.join(PROGRAM, "security/risk-register.json");
const risks = fs.existsSync(riskFile) ? JSON.parse(fs.readFileSync(riskFile, "utf8")).findings : [];
for (const r of risks) if (!r.id || !r.priority || !r.status || !r.owner?.repair) fail(`risk ${r.id ?? "?"}`, "risk needs id, priority, status and a repair owner (UNASSIGNED is explicit)");
// Security acceptance: a reviewed status needs an evidence record (security/acceptance/<id>.json).
const RISK_STATUSES = ["OPEN", "REPAIR_IN_PROGRESS", "REPAIR_PROPOSED", "COS_PASS", "COS_REVISE", "COS_BLOCKED", "FIXED_AWAITING_MERGE", "FIXED"];
const REVIEWED = new Set(["COS_PASS", "COS_REVISE", "COS_BLOCKED", "FIXED_AWAITING_MERGE", "FIXED"]);
for (const r of risks) {
  const at = `risk ${r.id}`;
  if (!RISK_STATUSES.includes(r.status)) { fail(at, `unknown status ${r.status}`); continue; }
  if (!REVIEWED.has(r.status)) continue;
  const file = path.join(PROGRAM, "security/acceptance", `${r.id}.json`);
  if (!fs.existsSync(file)) { fail(at, `status ${r.status} needs security/acceptance/${r.id}.json`); continue; }
  const a = JSON.parse(fs.readFileSync(file, "utf8"));
  const decision = { COS_PASS: "PASS", COS_REVISE: "REVISE", COS_BLOCKED: "BLOCKED", FIXED_AWAITING_MERGE: "PASS", FIXED: "PASS" }[r.status];
  if (a.finding !== r.id || a.decision !== decision) fail(at, `acceptance record must be for ${r.id} with decision ${decision}`);
  if (decision === "PASS") {
    const sha = /^[0-9a-f]{7,40}$/;
    if (!sha.test(a.testCommit ?? "") || !sha.test(a.fixCommit ?? "") || a.testCommit === a.fixCommit) fail(at, "PASS needs separate testCommit and fixCommit SHAs");
    if (a.failingBeforeFix?.result !== "FAIL" || a.failingBeforeFix?.commit !== a.testCommit) fail(at, "PASS needs the regression test FAILING at testCommit");
    if (a.passingAfterFix?.result !== "PASS" || a.passingAfterFix?.commit !== a.fixCommit) fail(at, "PASS needs the regression test PASSING at fixCommit");
    if (a.typecheck?.result !== "PASS") fail(at, "PASS needs TypeScript PASS at fixCommit");
    if (!(a.adjacentChecks ?? []).length) fail(at, "PASS needs at least one adjacent check");
    if (a.independentReview?.result !== "PASS") fail(at, "PASS needs an independent review without unresolved findings");
  } else if (!(a.reasons ?? []).length) fail(at, `${decision} needs the precise reasons`);
  if (r.status === "FIXED" && !a.mergeAuthorization) fail(at, "FIXED needs the founder's merge authorization reference");
}
const sim = simulate.run({ plans: plans.map((p) => p.plan), g3, drafts, reviews, releaseEvidence, securityGate, risks });
summary.schoolDay = sim.summary;
summary.openRisks = risks.filter((r) => r.status === "OPEN").map((r) => `${r.id} ${r.priority}${r.blocksPreview ? " (blocks preview)" : ""}: ${r.owner.repair}`);
summary.securityGate = securityGate.map((s) => ({ commit: s.commit, ref: s.ref, capturedAt: s.capturedAt, status: s.status, productionCritical: s.productionCritical, productionHighWithoutDisposition: s.productionHighWithoutDisposition.length }));

// ---------- outputs ----------
const header = { program: "stem-excellence-v1", generatedBy: "scripts/cos-stem/build-program.cjs", inventoryCapturedAt: inventory.extract?.capturedAt ?? inventory.extract?.captured ?? "2026-10-16T18:44:42.884Z", batches: batches.map((b) => `${b.version} (${b.state}${b.hold ? ", HELD" : ""})`) };
const outputs = {
  [path.join(PROGRAM, "course-catalog.json")]: JSON.stringify({ ...header, weekly: WEEKLY, courses }, null, 2) + "\n",
  [path.join(PROGRAM, "coverage-matrix.json")]: JSON.stringify({ ...header, summary, matrix }, null, 2) + "\n",
  [path.join(PROGRAM, "production-orders.json")]: JSON.stringify({ ...header, orders }, null, 2) + "\n",
  [P("docs/program/STEM_COVERAGE_MATRIX_V1.md")]: renderMarkdown(),
  [path.join(PROGRAM, "generation-backlog.json")]: JSON.stringify({ ...header, note: "Content Factory (T2) generation backlog. Orders run band by band in parallel; each lesson must pass G1-G8.", byBatch: Object.fromEntries([...new Set(generationOrders.map((o) => o.batch ?? "OTHER"))].sort().map((k) => [k, { open: generationOrders.filter((o) => (o.batch ?? "OTHER") === k && o.status === "OPEN").length, fulfilled: generationOrders.filter((o) => (o.batch ?? "OTHER") === k && o.status === "FULFILLED").length }])), orders: generationOrders }, null, 2) + "\n",
  [path.join(PROGRAM, "period-matrix.json")]: JSON.stringify({ ...header, summary: sim.summary, perGrade: sim.perGrade, rows: sim.rows }, null, 2) + "\n",
};
const rendered = sim.render({ generationOrders, autoBound });
outputs[P("docs/program/K12_PERIOD_MATRIX_V1.md")] = rendered.matrix + "\n";
outputs[P("docs/program/SCHOOL_DAY_SIMULATION_V1.md")] = rendered.simulation + "\n";
outputs[P("docs/program/GRADE_QUALITY_REPORTS_V1.md")] = rendered.quality + "\n";
// Every grade's resolved day (hand-authored or band template, with automatic bindings applied): the day shell reads these.
for (const { plan } of plans) outputs[path.join(PROGRAM, "resolved-days", `g${plan.grade}-day1.json`)] = JSON.stringify({ ...plan, developmentalBand: plan.developmentalBand ?? standards.developmentalBand(plan.grade) }, null, 2) + "\n";

function renderMarkdown() {
  const L = [];
  L.push("# STEM Coverage Matrix V1", "");
  L.push("Generated by `scripts/cos-stem/build-program.cjs` from the course catalog (`curriculum/program/stem-v1/source/courses.cjs`), the sealed draft.6 pins and the read-only live-catalog inventory captured 2026-10-16. Do not edit by hand. Machine-readable: `curriculum/program/stem-v1/coverage-matrix.json`.", "");
  L.push("## Status vocabulary", "");
  L.push("| Status | Meaning |", "| --- | --- |");
  L.push("| USABLE_APPROVED | A live lesson that has passed qualified independent review. **None has: the 2026-10-16 library audit is a mechanical/AI classification, and every judgment area still awaits qualified review.** |");
  L.push("| V4_DRAFT_IN_REVIEW | A V4 lesson exists for this course and grade: sealed draft.6, or a provisional Codex schoolday draft. Not approved; ungraded preview only after per-hash authorization. |");
  L.push("| CANDIDATE_IN_REVIEW | A modernization or Curriculum V2 candidate awaits independent review. |");
  L.push("| MODERNIZE_EXISTING | Live lessons exist that can be repaired or redesigned (tracks A/B). They are not approved-quality and must not be presented as official. |");
  L.push("| MISSING_HELD_ONLY | Live rows exist but every one is on governance hold or needs full rebuild. Treated as a missing course. |");
  L.push("| MISSING_NO_CONTENT | No lesson of any kind. A missing course. |");
  L.push("| TEACHER_LED | Arts/PE: on the timetable, taught by teachers, not platform curriculum. |", "");
  L.push("## Summary", "");
  L.push("| Measure | Value |", "| --- | ---: |");
  L.push(`| Course-grade cells (K-12) | ${summary.courseGradeCells} (${summary.platformCells} platform, ${summary.teacherLedCells} teacher-led) |`);
  L.push(`| Units specified | ${summary.units} |`);
  for (const [s, n] of Object.entries(summary.byStatus)) L.push(`| ${s} | ${n} |`);
  L.push(`| Missing courses (MISSING_*) | ${summary.missingCourses} |`);
  L.push(`| Live lessons catalogued / verified usable | ${summary.liveLessonsCatalogued} / ${summary.liveVerifiedUsable} |`);
  L.push(`| Factory lessons pinned (all batches) | ${summary.v4DraftLessons} (${Object.entries(summary.v4DraftsByVersion).map(([v, n]) => `${v}: ${n}`).join(", ")}) |`);
  L.push(`| Two-week pilot-window lesson target | ${summary.pilotWindowLessonTarget} |`);
  L.push(`| Full-year lesson target | ${summary.yearLessonTarget} |`);
  L.push(`| STEM share of the week (K-2 / 3-5 / 6-9 / 10-12) | ${Object.values(summary.stemShareOfWeek).join(" / ")} |`);
  L.push(`| Production orders in day plans | ${summary.productionOrders} |`, "");
  L.push("## Grade x course", "");
  L.push("Live counts are A/B/C/D modernization tracks (A targeted repair, B redesign, C rebuild, D governance hold). Senior Biology/Chemistry/Physics share the Grade 10-12 SCIENCE rows because the strand was never recorded.", "");
  L.push("| Grade | Course | Periods/wk | Status | Live (A/B/C/D) | V4 drafts | Day-plan periods | Pilot target | Year target | Blocks needed (proposed) | Labs |");
  L.push("| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | --- | --- |");
  for (const m of matrix) {
    const t = m.live.byTrack;
    const live = m.status === "TEACHER_LED" ? "-" : `${m.live.total} (${t.A}/${t.B}/${t.C}/${t.D})${m.live.sharedWithStrands ? "*" : ""}`;
    const periods = m.dayPlanPeriods.map((p) => `${p.planId.replace("stem1-", "")} ${p.slot}: ${p.binding === "V4_DRAFT" ? p.key : p.key}`).join("; ") || "-";
    L.push(`| ${m.gradeLabel} | ${m.course} | ${m.weeklyPeriods} | ${m.status} | ${live} | ${m.v4Drafts.join(", ") || "-"} | ${periods} | ${m.targets.pilotWindowLessons} | ${m.targets.yearLessons} | ${m.requiredBlocks.proposed.join(", ") || "-"} | ${m.labs.join(", ") || "-"} |`);
  }
  L.push("");
  return L.join("\n");
}

const check = process.argv.includes("--check");
let stale = 0;
for (const [file, text] of Object.entries(outputs)) {
  if (check) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (current !== text) { stale += 1; console.error(`STALE ${path.relative(ROOT, file)}`); }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}
if (errors.length) { console.error(errors.map((e) => `INVALID ${e}`).join("\n")); }
console.log(JSON.stringify(summary, null, 2));
if (errors.length || stale) process.exit(1);
