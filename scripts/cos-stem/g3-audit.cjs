#!/usr/bin/env node
/**
 * G3 academic QA (Chief of Staff): mechanical instruction-quality checks on factory-v4 packages.
 *
 *   node scripts/cos-stem/g3-audit.cjs <drafts/<version> dir> [<dir> ...]
 *
 * Reads packages read-only, maps each to its program course through the CoS pin registry
 * (scripts/cos-stem/lib/pins.cjs) and writes curriculum/program/stem-v1/g3-audit.json with findings and the
 * precise revision each finding requires. A lesson passes G3 only with zero BLOCKING or MAJOR findings.
 * Passing G3 is necessary, not sufficient: the independent academic review (AI-assisted, internal) and, for
 * any official claim, qualified human review still decide quality. Checks are defined in source/standards.cjs.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
// COS_STEM_PROGRAM points the audit at a temporary copy of the program (preflights only).
const PROGRAM = process.env.COS_STEM_PROGRAM ? path.resolve(process.env.COS_STEM_PROGRAM) : path.join(ROOT, "curriculum/program/stem-v1");
const S = require(path.join(PROGRAM, "source/standards.cjs"));
const { loadPackages } = require("./lib/pins.cjs");
const SHARED = new Set(["ORIENT", "RETRIEVE", "ASSESS"]);
const GUIDED = new Set(["SOLVE_WITH_SUPPORT", "EXPERIMENT", "UNDERSTAND", "INVESTIGATE", "BUILD_WITH_SUPPORT", "DESIGN", "DEMONSTRATE"]);
const SEVERITY = Object.fromEntries(S.G3_CHECKS.map((c) => [c.code, c.severity]));
const STEM_FAMILIES = new Set(["MATHEMATICS", "SCIENCE", "COMPUTING", "ENGINEERING"]);

const POLICY = /not an executable|automatically judged|No graded assessment|exact fraction is the primary answer|explicitly requesting rounding|No official assessment or score|no governed form|protected questions/i;
const TEMPLATE = /^(Work independently with the source information|Revisit the method and the learner'?s claim|Review your original response against the quantities|Choose a fresh example and explain how the representation or evidence supports your conclusion)/i;
const GENERIC_ACTION = /Use the model, complete its task|Make a prediction or proposed solution and give a reason|With your teacher, plan the described practical activity|Read the draft assessment status/i;
const { CORRUPT: MOJIBAKE } = require("./lib/package-integrity.cjs"); // shared with intake; mirrors T2 textIntegrity.ts
const SIM_TOPIC = /state|matter|melt|freez|heating curve/i;
const CODE_TEXT = /\bfor each\b|\bif\b.+\bthen\b|count\s*=|\breturn\b|\bfunction\b|pseudocode/i;
const titles = (scenes) => scenes.map((s) => `"${s.title}"`).join(", ");

const REVISION = {
  MOJIBAKE: (d) => `Re-encode the generator sources and package text as UTF-8 and normalize Unicode (NFC); restore every mis-decoded character, including dashes ("â€”" → "—", "â€“" → "–") and the minus sign ("âˆ’" → "−") in arithmetic (${d}). The factory text-integrity check must run on every output file.`,
  WEAK_REASONING: (d) => `Add tasks that make the learner explain, justify or defend their reasoning (${d}), with feedback on the reasoning, not only the answer.`,
  GUIDED_WITHOUT_FEEDBACK: (d) => `Give each guided scene a block that responds to the learner's own attempt (check, numeric response, mistake analysis, sort, sequence or evidence selection): ${d}.`,
  TITLE_PREFIX: () => "Remove the generator prefix from the learner-facing title.",
  LEARNER_SEES_POLICY_TEXT: (d) => `Move system, policy and answer-policy text out of learner fields into the teacher/reviewer projection: ${d}.`,
  TEMPLATE_BODY: (d) => `Replace the generic template body with lesson-specific teaching: ${d}.`,
  SINGLE_MISCONCEPTION: (d) => `Declare at least two named, objective-linked misconceptions (now ${d}); give each a diagnostic distractor or mistake analysis and targeted feedback.`,
  NO_HINTS_IN_GUIDED: (d) => `Add a meaningful hint before the answer in each guided scene: ${d}. Keep independent scenes hint-free.`,
  TWO_OPTION_CHECKS: (d) => `Give choice items at least three plausible options, each wrong option tied to a misconception (${d}).`,
  GENERIC_LEARNER_ACTION: (d) => `Rewrite each learner action to say exactly what to do in this lesson: ${d}.`,
  SUBJECT_RECORDED_WRONG: (d) => `Record the course's subject code (${d}).`,
  PATTERN_MISMATCH: (d) => `Restructure the scenes to the family pattern (${d}).`,
  UNUSED_AVAILABLE_SIMULATION: () => "Use the registered PARTICLE_MODEL and PREDICT_OBSERVE blocks for the phase-change investigation.",
  DEVELOPMENTAL_MISMATCH: (d) => `Fit the task to the developmental band: ${d}.`,
  PROGRESSION_INCOMPLETE: (d) => `Add the missing instructional moves (${d}) so the learner meets a new idea, investigates, practises, applies and gets feedback.`,
  TEMPLATE_STRUCTURE: (d) => `Design this lesson's structure for its subject rather than the shared template (${d}).`,
  RIGOR_BELOW_BAND: (d) => `Raise the STEM demand to the grade band: ${d}.`,
  ROLE_CONTRACT_UNMET: (d) => `Meet the activity role contract in source/standards.cjs ROLE_CONTRACTS (${d}).`,
};

const pins = loadPackages(PROGRAM);
const dirs = process.argv.slice(2);
if (!dirs.length) { console.error("usage: g3-audit.cjs <drafts dir> ..."); process.exit(2); }

const lessons = [];
for (const dir of dirs) {
  const receipt = JSON.parse(fs.readFileSync(path.join(dir, "generation-receipt.json"), "utf8"));
  for (const pkg of receipt.packages) {
    const base = path.join(dir, pkg.key);
    lessons.push({
      version: receipt.version, pkg,
      c: JSON.parse(fs.readFileSync(path.join(base, "candidate.json"), "utf8")),
      m: JSON.parse(fs.readFileSync(path.join(base, "manifest.json"), "utf8")),
      learner: fs.readFileSync(path.join(base, "learner-projection.json"), "utf8"),
      pin: pins.find((p) => p.key === pkg.key && p.version === receipt.version),
    });
  }
}

// Structural signature: the phase sequence plus the set of block types. Shared across courses = one template.
const signature = (c) => `${c.scenes.map((s) => s.teaching?.phase ?? s.type).join(">")}|${[...new Set(c.scenes.flatMap((s) => (s.teaching?.blocks ?? []).map((b) => b.type)))].sort().join(",")}`;
const sigs = lessons.map((l) => ({ sig: signature(l.c), course: l.pin?.course ?? l.m.subject }));

const results = lessons.map((l, i) => {
  const { c, m, learner, pin, pkg, version } = l;
  const findings = [];
  const add = (code, detail) => findings.push({ code, severity: SEVERITY[code], detail, revision: REVISION[code](detail) });
  const blocks = c.scenes.flatMap((s) => s.teaching?.blocks ?? []);
  const role = pin?.orderKind && pin.orderKind !== "LESSON" ? pin.orderKind : "LESSON";
  const fam = pin && role === "LESSON" ? S.COURSE_FAMILY[pin.course] : null;
  const band = S.developmentalBand(pin?.grade ?? m.grade);

  const moji = learner.match(new RegExp(MOJIBAKE.source, "gu")) ?? [];
  if (moji.length) add("MOJIBAKE", `${moji.length} occurrence(s) in the learner projection`);
  if (/^Generated:/i.test(c.title)) add("TITLE_PREFIX", c.title);
  const policy = c.scenes.filter((s) => POLICY.test(s.content?.body ?? "") || POLICY.test(s.learnerAction ?? ""));
  if (policy.length) add("LEARNER_SEES_POLICY_TEXT", `scenes ${titles(policy)}`);
  const template = c.scenes.filter((s) => TEMPLATE.test((s.content?.body ?? "").trim()));
  if (template.length) add("TEMPLATE_BODY", `scenes ${titles(template)}`);
  const ids = new Set([...c.scenes.flatMap((s) => s.misconceptionIds ?? []), ...blocks.flatMap((b) => [b.misconceptionId, ...(b.items ?? []).map((it) => it.misconceptionId)]).filter(Boolean)]);
  const real = [...ids].filter((id) => !/^generated-/.test(id));
  if (real.length < 2) add("SINGLE_MISCONCEPTION", `${real.length} named; ids: ${[...ids].join(", ") || "none"}`);
  const guidedNoHint = c.scenes.filter((s) => GUIDED.has(s.teaching?.phase) && !(s.hints ?? []).length);
  if (guidedNoHint.length) add("NO_HINTS_IN_GUIDED", `scenes ${titles(guidedNoHint)}`);
  const opts = blocks.flatMap((b) => (b.type === "CHECK" ? b.items.map((it) => it.options.length) : b.type === "MISTAKE_ANALYSIS" ? [b.options.length] : []));
  const two = opts.filter((n) => n === 2).length;
  if (opts.length >= 2 && two / opts.length > 0.5) add("TWO_OPTION_CHECKS", `${two} of ${opts.length} choice items have two options`);
  const generic = c.scenes.filter((s) => GENERIC_ACTION.test(s.learnerAction ?? ""));
  if (generic.length) add("GENERIC_LEARNER_ACTION", `scenes ${titles(generic)}`);

  const phases = c.scenes.map((s) => s.teaching?.phase).filter((p) => p && !SHARED.has(p));
  if (fam) {
    if (!fam.recordedSubjects.includes(m.subject)) add("SUBJECT_RECORDED_WRONG", `course ${pin.course} expects ${fam.recordedSubjects.join("/")}, package records ${m.subject}`);
    const expected = new Set(S.PATTERNS[fam.family]);
    if (phases.length && phases.filter((p) => expected.has(p)).length / phases.length < 0.6) add("PATTERN_MISMATCH", `${fam.family}: ${S.PATTERNS[fam.family].join(" > ")}; package has ${phases.join(" > ")}`);
    if (fam.family === "SCIENCE" && SIM_TOPIC.test(`${c.title} ${pkg.key}`) && !blocks.some((b) => ["PARTICLE_MODEL", "PREDICT_OBSERVE"].includes(b.type))) add("UNUSED_AVAILABLE_SIMULATION", "-");
    const writing = Math.max(0, ...blocks.filter((b) => b.type === "WRITING_ORGANIZER").map((b) => b.fields.reduce((a, f) => a + f.minWords, 0)));
    const limit = S.DEVELOPMENTAL[band].independentWritingWords[1];
    const dev = S.DEVELOPMENTAL[band];
    const age = [];
    if (writing > limit * 1.5) age.push(`a writing task requires ${writing} words; band ${band} expects at most ${limit}`);
    const bodies = c.scenes.map((s) => ({ title: s.title, text: (s.content?.body ?? "").trim() })).filter((x) => x.text);
    const longScenes = bodies.filter((x) => x.text.split(/\s+/).length > dev.maxSceneBodyWords);
    if (longScenes.length) age.push(`scene text over ${dev.maxSceneBodyWords} words for band ${band}: ${longScenes.map((x) => `"${x.title}"`).join(", ")}`);
    const sentences = bodies.flatMap((x) => x.text.split(/(?<=[.!?])\s+/)).map((s) => s.split(/\s+/).length);
    const avgSentence = sentences.length ? sentences.reduce((a, n) => a + n, 0) / sentences.length : 0;
    if (avgSentence > dev.maxSentenceWords) age.push(`average sentence ${avgSentence.toFixed(1)} words; band ${band} reads at most ${dev.maxSentenceWords}`);
    if (age.length) add("DEVELOPMENTAL_MISMATCH", age.join("; "));
  } else if (role !== "LESSON") {
    // Support and end-of-day activities serve the whole day, not one course: no course subject or family
    // pattern applies. Their own contract (source/standards.cjs ROLE_CONTRACTS) is checked below, and the
    // same age-appropriateness limits apply.
    const dev = S.DEVELOPMENTAL[band];
    const bodies = c.scenes.map((s) => ({ title: s.title, text: (s.content?.body ?? "").trim() })).filter((x) => x.text);
    const longScenes = bodies.filter((x) => x.text.split(/\s+/).length > dev.maxSceneBodyWords);
    const sentences = bodies.flatMap((x) => x.text.split(/(?<=[.!?])\s+/)).map((s) => s.split(/\s+/).length);
    const avgSentence = sentences.length ? sentences.reduce((a, n) => a + n, 0) / sentences.length : 0;
    const age = [...(longScenes.length ? [`scene text over ${dev.maxSceneBodyWords} words for band ${band}: ${longScenes.map((x) => `"${x.title}"`).join(", ")}`] : []), ...(avgSentence > dev.maxSentenceWords ? [`average sentence ${avgSentence.toFixed(1)} words; band ${band} reads at most ${dev.maxSentenceWords}`] : [])];
    if (age.length) add("DEVELOPMENTAL_MISMATCH", age.join("; "));
    const contract = S.ROLE_CONTRACTS[role];
    if (!contract) add("ROLE_CONTRACT_UNMET", `unknown order kind ${role}`);
    else {
      const unmet = contract.checks.filter((chk) => !chk.test(c)).map((chk) => chk.what);
      if (unmet.length) add("ROLE_CONTRACT_UNMET", `${role}: ${unmet.join("; ")}`);
    }
  } else {
    add("SUBJECT_RECORDED_WRONG", "package is not pinned to a program course; subject and pattern cannot be checked");
  }

  const REASON = /\b(explain|justify|why|evidence|prove|defend|reason|argue|convince|compare .* and decide)\b/i;
  const reasoningTasks = c.scenes.filter((s) => REASON.test(s.learnerAction ?? "") || (s.teaching?.blocks ?? []).some((b) => ["MISTAKE_ANALYSIS", "WRITING_ORGANIZER", "SOURCE_EVIDENCE"].includes(b.type) || (b.type === "PREDICT_OBSERVE" && b.explainPrompt)));
  const minReasoning = role === "END_OF_DAY_REFLECTION" ? 1 : 2;
  if (reasoningTasks.length < minReasoning) add("WEAK_REASONING", `${reasoningTasks.length} reasoning task(s); ${role} needs ${minReasoning}`);
  const guidedNoFeedback = c.scenes.filter((s) => GUIDED.has(s.teaching?.phase) && s.teaching?.phase !== "DEMONSTRATE" && !(s.teaching?.blocks ?? []).some((b) => S.FEEDBACK_BLOCKS.includes(b.type)) && s.interaction?.kind !== "SINGLE_CHOICE");
  if (guidedNoFeedback.length) add("GUIDED_WITHOUT_FEEDBACK", `scenes ${titles(guidedNoFeedback)}`);

  const allPhases = c.scenes.map((s) => s.teaching?.phase).filter(Boolean);
  // A full lesson needs all five moves; support and end-of-day activities need the moves their role requires.
  const requiredMoves = role === "LESSON" ? Object.keys(S.PROGRESSION) : S.ROLE_CONTRACTS[role]?.requiredMoves ?? Object.keys(S.PROGRESSION);
  const missingMoves = Object.entries(S.PROGRESSION).filter(([move]) => requiredMoves.includes(move)).filter(([move, list]) => {
    if (allPhases.some((p) => list.includes(p))) return false;
    return !(move === "FEEDBACK" && blocks.some((b) => S.FEEDBACK_BLOCKS.includes(b.type)));
  }).map(([move]) => move);
  if (missingMoves.length) add("PROGRESSION_INCOMPLETE", `missing ${missingMoves.join(", ")}`);

  const twins = sigs.filter((s, j) => j !== i && s.sig === sigs[i].sig && s.course !== sigs[i].course);
  if (twins.length >= 2) add("TEMPLATE_STRUCTURE", `same phases and blocks as ${twins.length} lessons in other courses (${[...new Set(twins.map((t) => t.course))].join(", ")})`);

  const signals = {
    quantitative: blocks.reduce((a, b) => a + (b.type === "NUMERIC_RESPONSE" ? b.parts.length : ["AREA_MODEL", "FRACTION_NUMBER_LINE", "FRACTION_COMPARE", "EQUATION"].includes(b.type) ? 1 : 0), 0),
    data: blocks.some((b) => ["DATA_PLOT", "PARTICLE_MODEL", "PREDICT_OBSERVE"].includes(b.type)),
    modelOrCode: blocks.some((b) => b.type === "EQUATION" || (b.type === "WORKED_SOLUTION" && b.steps.some((st) => st.tex))) || c.scenes.some((s) => CODE_TEXT.test(`${s.content?.body ?? ""} ${s.learnerAction ?? ""}`)),
    justification: blocks.some((b) => ["WRITING_ORGANIZER", "MISTAKE_ANALYSIS"].includes(b.type)),
    progression: Object.keys(S.PROGRESSION).filter((mv) => !missingMoves.includes(mv)),
    progressionComplete: missingMoves.length === 0,
    role,
    blockTypes: [...new Set(blocks.map((b) => b.type))].sort(),
  };
  if (fam && STEM_FAMILIES.has(fam.family)) {
    const r = S.RIGOR[band];
    const { quantitative, data, modelOrCode, justification } = signals;
    const gaps = [];
    if (quantitative < r.minQuantitativeTasks) gaps.push(`${quantitative} quantitative tasks, band ${band} needs ${r.minQuantitativeTasks}`);
    if (r.dataFor.includes(fam.family) && !data) gaps.push("no data the learner works with");
    if (r.modelOrCodeFor.includes(fam.family) && !modelOrCode) gaps.push("no quantitative model or code");
    if (r.requiresJustification && !justification) gaps.push("no written justification or mistake analysis");
    if (gaps.length) add("RIGOR_BELOW_BAND", `${r.expects}: ${gaps.join("; ")}`);
  }

  const blocking = findings.filter((f) => f.severity === "BLOCKING" || f.severity === "MAJOR").length;
  return {
    version, key: pkg.key, packageHash: pkg.packageHash, candidateSha256: pkg.candidateSha256,
    grade: pin?.grade ?? m.grade, course: pin?.course ?? null, orderId: pin?.orderId ?? null, title: c.title,
    g3: blocking ? "G3_REVISE" : "G3_PASS", signals, findings,
  };
});

// Results accumulate: lessons from versions not audited in this run are kept as they were.
const outFile = path.join(PROGRAM, "g3-audit.json");
const auditedNow = new Set(results.map((r) => r.version));
if (fs.existsSync(outFile)) for (const prior of JSON.parse(fs.readFileSync(outFile, "utf8")).lessons) if (!auditedNow.has(prior.version)) results.push(prior);
results.sort((a, b) => a.grade - b.grade || a.key.localeCompare(b.key));
const out = {
  generatedBy: "scripts/cos-stem/g3-audit.cjs",
  standard: "curriculum/program/stem-v1/source/standards.cjs",
  note: "Mechanical G3 evidence. Independent academic review (AI-assisted, internal) is recorded separately in reviews/; no human subject-expert approval is claimed.",
  audited: [...new Set(results.map((r) => r.version))],
  lessons: results,
};
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
const tally = {};
for (const r of results) for (const f of r.findings) tally[f.code] = (tally[f.code] ?? 0) + 1;
console.log(JSON.stringify({ lessons: results.length, pass: results.filter((r) => r.g3 === "G3_PASS").length, tally }, null, 2));
