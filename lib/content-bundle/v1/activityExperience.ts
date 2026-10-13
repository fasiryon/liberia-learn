/**
 * Activity experience V1 (PROVISIONAL): the learner-facing body of an ActivityDefinition.
 *
 * Carried in `ActivityDefinition.extensions.experience`, so it is part of the sealed content hash
 * and of the validator's forbidden-key scan (no student state, runtime fields or inline answer
 * keys). It is content only: it records nothing about a learner and grants no mastery authority.
 *
 * No hidden answers. Every value a feedback message uses is either stated in the prompt (the
 * fraction a learner is asked to shade or mark) or drawn on screen (the parts a picture shows).
 * There are no answer, solution or key fields, and the parser rejects unknown fields.
 *
 * The learner projection is an allow-list. Teacher facilitation, look-fors, misconceptions,
 * materials planning, evidence notes and alignment refs never leave `teacher`.
 */
import type { ActivityDefinition, JsonValue } from "./types";

export const ACTIVITY_EXPERIENCE_SCHEMA = "activity-experience.v1" as const;

export const EXPERIENCE_PROFILES = ["GUIDED_PRACTICE", "INDEPENDENT_PRACTICE", "CLASSWORK", "HOMEWORK"] as const;
export type ExperienceProfile = (typeof EXPERIENCE_PROFILES)[number];

export const SET_OBJECTS = ["BOTTLE_CAP", "MANGO", "STONE"] as const;
export type SetObject = (typeof SET_OBJECTS)[number];

/** Largest whole a Grade 4 picture shows; keeps sets countable and targets usable on a phone. */
export const MAX_PARTS = 12;
export const MAX_STRIP_PARTS = 8;

export type Fraction = Readonly<{ numerator: number; denominator: number }>;

export type FractionVisual =
  /** A whole cut into parts. `widths` (relative) draws unequal parts; omitted means equal. */
  | Readonly<{ kind: "STRIP"; parts: number; shaded: readonly number[]; widths: readonly number[] | null; label: string }>
  /** A set of objects, optionally arranged in equal groups. */
  | Readonly<{ kind: "SET"; objects: number; object: SetObject; marked: readonly number[]; groups: number | null; label: string }>;

export type ExperienceTask =
  /** Tap parts of a strip to shade the fraction the prompt names. */
  | Readonly<{ kind: "SHADE_STRIP"; parts: number; ask: Fraction }>
  /** Tap objects to mark the fraction of the set the prompt names. */
  | Readonly<{ kind: "MARK_SET"; objects: number; object: SetObject; groups: number | null; ask: Fraction }>
  /** Build the fraction a picture shows with top/bottom number steppers. */
  | Readonly<{ kind: "NAME_FRACTION"; visual: FractionVisual }>
  /** Decide whether a whole is cut into equal parts. */
  | Readonly<{ kind: "EQUAL_PARTS"; visual: FractionVisual }>
  /** Done on paper or with real objects; the picture is a model, nothing is checked on screen. */
  | Readonly<{ kind: "ON_PAPER"; visual: FractionVisual | null }>;

export type ExperienceItem = Readonly<{ itemKey: string; prompt: string; task: ExperienceTask; hints: readonly string[] }>;
export type WorkedStep = Readonly<{ stepKey: string; text: string; visual: FractionVisual }>;
export type WorkedExample = Readonly<{ exampleKey: string; title: string; prompt: string; steps: readonly WorkedStep[] }>;
export type PairRole = Readonly<{ role: string; text: string }>;

export type LearnerExperience = Readonly<{
  /** Child-friendly goal ("I can ..."). */
  goal: string;
  intro: string;
  /** What this is for: practice versus classwork versus homework. Never claims to be a test. */
  purposeNote: string;
  materials: readonly string[];
  roles: readonly PairRole[];
  workedExamples: readonly WorkedExample[];
  items: readonly ExperienceItem[];
  selfCheck: readonly string[];
  familyNote: string | null;
  offline: Readonly<{ worksOffline: boolean; note: string }>;
}>;

export type TeacherPhase = Readonly<{ label: string; minutes: number; text: string }>;
export type TeacherMaterial = Readonly<{ text: string; required: boolean }>;
export type Misconception = Readonly<{ sign: string; response: string }>;

export type TeacherExperience = Readonly<{
  summary: string;
  phases: readonly TeacherPhase[];
  grouping: string | null;
  materials: readonly TeacherMaterial[];
  lookFors: readonly string[];
  misconceptions: readonly Misconception[];
  differentiation: Readonly<{ support: readonly string[]; extend: readonly string[] }>;
  /** What the evidence intent means in the classroom. Describes intent; this content records nothing. */
  evidenceNote: string;
  /** Real repository refs this content is a candidate for. Alignment is not approval. */
  alignment: Readonly<{ candidateObjectiveRefs: readonly string[]; candidateLessonRefs: readonly string[]; reviewState: "UNREVIEWED_CANDIDATE" }>;
}>;

export type ActivityExperienceV1 = Readonly<{
  schema: typeof ACTIVITY_EXPERIENCE_SCHEMA;
  profile: ExperienceProfile;
  learner: LearnerExperience;
  teacher: TeacherExperience;
}>;

/** Learner-safe projection: the allow-listed learner body plus the profile. */
export type LearnerActivityExperience = Readonly<{ schema: typeof ACTIVITY_EXPERIENCE_SCHEMA; profile: ExperienceProfile } & LearnerExperience>;

export const PROFILE_LABELS: Readonly<Record<ExperienceProfile, string>> = {
  GUIDED_PRACTICE: "Guided practice",
  INDEPENDENT_PRACTICE: "Independent practice",
  CLASSWORK: "Classwork",
  HOMEWORK: "Homework",
};

// ─── Strict parser ──────────────────────────────────────────────────────────────────────────────

export type ExperienceIssue = Readonly<{ path: string; message: string }>;
export type ExperienceParse = Readonly<{ ok: true; experience: ActivityExperienceV1 }> | Readonly<{ ok: false; issues: readonly ExperienceIssue[] }>;

class Fail extends Error {
  constructor(readonly path: string, message: string) { super(message); }
}

type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

function rec(v: unknown, path: string, keys: readonly string[]): Rec {
  if (!isRec(v)) throw new Fail(path, "expected an object");
  for (const key of Object.keys(v)) if (!keys.includes(key)) throw new Fail(`${path}.${key}`, "unknown field");
  return v;
}
function str(v: unknown, path: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new Fail(path, "expected non-empty text");
  return v;
}
function strOrNull(v: unknown, path: string): string | null {
  return v === null ? null : str(v, path);
}
function int(v: unknown, path: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) throw new Fail(path, `expected a whole number from ${min} to ${max}`);
  return v;
}
function arr<T>(v: unknown, path: string, each: (entry: unknown, path: string) => T, min = 0): T[] {
  if (!Array.isArray(v)) throw new Fail(path, "expected a list");
  if (v.length < min) throw new Fail(path, `expected at least ${min} entries`);
  return v.map((entry, i) => each(entry, `${path}[${i}]`));
}
function oneOf<T extends string>(v: unknown, path: string, values: readonly T[]): T {
  if (typeof v !== "string" || !values.includes(v as T)) throw new Fail(path, `expected one of ${values.join(", ")}`);
  return v as T;
}
function indices(v: unknown, path: string, size: number): number[] {
  const list = arr(v, path, (e, p) => int(e, p, 0, size - 1));
  if (new Set(list).size !== list.length) throw new Fail(path, "duplicate index");
  return [...list].sort((a, b) => a - b);
}
function uniqueKeys(list: readonly { key: string; path: string }[]) {
  const seen = new Set<string>();
  for (const { key, path } of list) {
    if (seen.has(key)) throw new Fail(path, "duplicate key");
    seen.add(key);
  }
}

function groupsFor(v: unknown, path: string, objects: number): number | null {
  if (v === null) return null;
  const groups = int(v, path, 2, objects);
  if (objects % groups !== 0) throw new Fail(path, "groups must share the set equally");
  return groups;
}

function visual(v: unknown, path: string): FractionVisual {
  const kind = oneOf(isRec(v) ? v.kind : undefined, `${path}.kind`, ["STRIP", "SET"] as const);
  if (kind === "STRIP") {
    const r = rec(v, path, ["kind", "parts", "shaded", "widths", "label"]);
    const parts = int(r.parts, `${path}.parts`, 2, MAX_STRIP_PARTS);
    const widths = r.widths === null ? null : arr(r.widths, `${path}.widths`, (e, p) => int(e, p, 1, 12));
    if (widths && widths.length !== parts) throw new Fail(`${path}.widths`, "one width per part");
    return { kind, parts, shaded: indices(r.shaded, `${path}.shaded`, parts), widths, label: str(r.label, `${path}.label`) };
  }
  const r = rec(v, path, ["kind", "objects", "object", "marked", "groups", "label"]);
  const objects = int(r.objects, `${path}.objects`, 2, MAX_PARTS);
  return { kind, objects, object: oneOf(r.object, `${path}.object`, SET_OBJECTS), marked: indices(r.marked, `${path}.marked`, objects), groups: groupsFor(r.groups, `${path}.groups`, objects), label: str(r.label, `${path}.label`) };
}

/** A construction task is only fair when the prompt itself states the fraction to make. */
function ask(v: unknown, path: string, whole: number, prompt: string, setSize: number | null): Fraction {
  const r = rec(v, path, ["numerator", "denominator"]);
  const denominator = int(r.denominator, `${path}.denominator`, 2, MAX_PARTS);
  const numerator = int(r.numerator, `${path}.numerator`, 1, denominator);
  if (setSize === null && denominator !== whole) throw new Fail(path, "a strip task asks for a fraction with the strip's number of parts");
  if (setSize !== null && setSize % denominator !== 0) throw new Fail(path, "the set must share equally into the denominator");
  if (!prompt.includes(`${numerator}/${denominator}`)) throw new Fail(path, "the prompt must state the fraction to make");
  return { numerator, denominator };
}

function task(v: unknown, path: string, prompt: string): ExperienceTask {
  const kind = oneOf(isRec(v) ? v.kind : undefined, `${path}.kind`, ["SHADE_STRIP", "MARK_SET", "NAME_FRACTION", "EQUAL_PARTS", "ON_PAPER"] as const);
  switch (kind) {
    case "SHADE_STRIP": {
      const r = rec(v, path, ["kind", "parts", "ask"]);
      const parts = int(r.parts, `${path}.parts`, 2, MAX_STRIP_PARTS);
      return { kind, parts, ask: ask(r.ask, `${path}.ask`, parts, prompt, null) };
    }
    case "MARK_SET": {
      const r = rec(v, path, ["kind", "objects", "object", "groups", "ask"]);
      const objects = int(r.objects, `${path}.objects`, 2, MAX_PARTS);
      const groups = groupsFor(r.groups, `${path}.groups`, objects);
      const asked = ask(r.ask, `${path}.ask`, objects, prompt, objects);
      if (groups !== null && groups !== asked.denominator) throw new Fail(`${path}.groups`, "drawn groups must match the denominator");
      return { kind, objects, object: oneOf(r.object, `${path}.object`, SET_OBJECTS), groups, ask: asked };
    }
    case "NAME_FRACTION": {
      const r = rec(v, path, ["kind", "visual"]);
      const shown = visual(r.visual, `${path}.visual`);
      if (shown.kind === "STRIP" && shown.widths !== null) throw new Fail(`${path}.visual.widths`, "name a fraction only from equal parts");
      if ((shown.kind === "STRIP" ? shown.shaded : shown.marked).length === 0) throw new Fail(`${path}.visual`, "the picture must show the parts to name");
      return { kind, visual: shown };
    }
    case "EQUAL_PARTS": {
      const r = rec(v, path, ["kind", "visual"]);
      const shown = visual(r.visual, `${path}.visual`);
      if (shown.kind !== "STRIP") throw new Fail(`${path}.visual.kind`, "equal-parts questions use a strip");
      return { kind, visual: shown };
    }
    case "ON_PAPER": {
      const r = rec(v, path, ["kind", "visual"]);
      return { kind, visual: r.visual === null ? null : visual(r.visual, `${path}.visual`) };
    }
  }
}

function item(v: unknown, path: string): ExperienceItem {
  const r = rec(v, path, ["itemKey", "prompt", "task", "hints"]);
  const prompt = str(r.prompt, `${path}.prompt`);
  return { itemKey: str(r.itemKey, `${path}.itemKey`), prompt, task: task(r.task, `${path}.task`, prompt), hints: arr(r.hints, `${path}.hints`, str) };
}

function workedExample(v: unknown, path: string): WorkedExample {
  const r = rec(v, path, ["exampleKey", "title", "prompt", "steps"]);
  const steps = arr(r.steps, `${path}.steps`, (s, p) => {
    const step = rec(s, p, ["stepKey", "text", "visual"]);
    return { stepKey: str(step.stepKey, `${p}.stepKey`), text: str(step.text, `${p}.text`), visual: visual(step.visual, `${p}.visual`) };
  }, 2);
  uniqueKeys(steps.map((s, i) => ({ key: s.stepKey, path: `${path}.steps[${i}].stepKey` })));
  return { exampleKey: str(r.exampleKey, `${path}.exampleKey`), title: str(r.title, `${path}.title`), prompt: str(r.prompt, `${path}.prompt`), steps };
}

function learner(v: unknown, path: string): LearnerExperience {
  const r = rec(v, path, ["goal", "intro", "purposeNote", "materials", "roles", "workedExamples", "items", "selfCheck", "familyNote", "offline"]);
  const offline = rec(r.offline, `${path}.offline`, ["worksOffline", "note"]);
  if (typeof offline.worksOffline !== "boolean") throw new Fail(`${path}.offline.worksOffline`, "expected true or false");
  const items = arr(r.items, `${path}.items`, item, 1);
  uniqueKeys(items.map((it, i) => ({ key: it.itemKey, path: `${path}.items[${i}].itemKey` })));
  return {
    goal: str(r.goal, `${path}.goal`),
    intro: str(r.intro, `${path}.intro`),
    purposeNote: str(r.purposeNote, `${path}.purposeNote`),
    materials: arr(r.materials, `${path}.materials`, str),
    roles: arr(r.roles, `${path}.roles`, (e, p) => { const role = rec(e, p, ["role", "text"]); return { role: str(role.role, `${p}.role`), text: str(role.text, `${p}.text`) }; }),
    workedExamples: arr(r.workedExamples, `${path}.workedExamples`, workedExample),
    items,
    selfCheck: arr(r.selfCheck, `${path}.selfCheck`, str),
    familyNote: strOrNull(r.familyNote, `${path}.familyNote`),
    offline: { worksOffline: offline.worksOffline, note: str(offline.note, `${path}.offline.note`) },
  };
}

function teacher(v: unknown, path: string): TeacherExperience {
  const r = rec(v, path, ["summary", "phases", "grouping", "materials", "lookFors", "misconceptions", "differentiation", "evidenceNote", "alignment"]);
  const diff = rec(r.differentiation, `${path}.differentiation`, ["support", "extend"]);
  const align = rec(r.alignment, `${path}.alignment`, ["candidateObjectiveRefs", "candidateLessonRefs", "reviewState"]);
  return {
    summary: str(r.summary, `${path}.summary`),
    phases: arr(r.phases, `${path}.phases`, (e, p) => { const ph = rec(e, p, ["label", "minutes", "text"]); return { label: str(ph.label, `${p}.label`), minutes: int(ph.minutes, `${p}.minutes`, 1, 120), text: str(ph.text, `${p}.text`) }; }, 1),
    grouping: strOrNull(r.grouping, `${path}.grouping`),
    materials: arr(r.materials, `${path}.materials`, (e, p) => {
      const m = rec(e, p, ["text", "required"]);
      if (typeof m.required !== "boolean") throw new Fail(`${p}.required`, "expected true or false");
      return { text: str(m.text, `${p}.text`), required: m.required };
    }),
    lookFors: arr(r.lookFors, `${path}.lookFors`, str, 1),
    misconceptions: arr(r.misconceptions, `${path}.misconceptions`, (e, p) => { const m = rec(e, p, ["sign", "response"]); return { sign: str(m.sign, `${p}.sign`), response: str(m.response, `${p}.response`) }; }),
    differentiation: { support: arr(diff.support, `${path}.differentiation.support`, str), extend: arr(diff.extend, `${path}.differentiation.extend`, str) },
    evidenceNote: str(r.evidenceNote, `${path}.evidenceNote`),
    alignment: {
      candidateObjectiveRefs: arr(align.candidateObjectiveRefs, `${path}.alignment.candidateObjectiveRefs`, str),
      candidateLessonRefs: arr(align.candidateLessonRefs, `${path}.alignment.candidateLessonRefs`, str),
      reviewState: oneOf(align.reviewState, `${path}.alignment.reviewState`, ["UNREVIEWED_CANDIDATE"] as const),
    },
  };
}

/** Profile rules that keep the four experiences genuinely different, checked against the definition. */
function checkProfile(exp: ActivityExperienceV1, activity: Pick<ActivityDefinition, "identity" | "scaffolding" | "collaborationMode"> | null) {
  const { profile, learner: l, teacher: t } = exp;
  const interactive = l.items.filter((it) => it.task.kind !== "ON_PAPER");
  if (profile === "GUIDED_PRACTICE") {
    if (l.workedExamples.length < 1) throw new Fail("learner.workedExamples", "guided practice models at least one example");
    l.items.forEach((it, i) => { if (it.hints.length < 2) throw new Fail(`learner.items[${i}].hints`, "guided practice scaffolds each item with at least two hints"); });
    if (interactive.length !== l.items.length) throw new Fail("learner.items", "guided practice items give on-screen feedback");
  }
  if (profile === "INDEPENDENT_PRACTICE") {
    if (l.workedExamples.length > 0) throw new Fail("learner.workedExamples", "independent practice does not model examples");
    if (l.items.length < 4) throw new Fail("learner.items", "independent practice offers several items");
    l.items.forEach((it, i) => { if (it.hints.length > 1) throw new Fail(`learner.items[${i}].hints`, "independent practice offers at most one hint"); });
    if (interactive.length !== l.items.length) throw new Fail("learner.items", "independent practice items give on-screen feedback");
  }
  if (profile === "CLASSWORK") {
    if (t.phases.length < 2) throw new Fail("teacher.phases", "classwork is teacher-led in phases");
    if (t.materials.length < 1) throw new Fail("teacher.materials", "classwork lists its materials");
  }
  if (profile === "HOMEWORK") {
    if (!l.offline.worksOffline) throw new Fail("learner.offline.worksOffline", "homework must work offline");
    if (interactive.length > 0) throw new Fail("learner.items", "homework is done on paper; it cannot depend on a connection or device");
    if (l.selfCheck.length < 1) throw new Fail("learner.selfCheck", "homework without a teacher needs a self-check");
  }
  if (!activity) return;
  const kind = activity.identity.itemKind;
  const expected: ExperienceProfile | null =
    kind === "PRACTICE" ? (activity.scaffolding === "GUIDED" ? "GUIDED_PRACTICE" : activity.scaffolding === "INDEPENDENT" ? "INDEPENDENT_PRACTICE" : null)
      : kind === "CLASSWORK" ? "CLASSWORK" : kind === "HOMEWORK" ? "HOMEWORK" : null;
  if (expected !== profile) throw new Fail("profile", `profile ${profile} does not match a ${kind} activity with ${activity.scaffolding ?? "no"} scaffolding`);
  if ((activity.collaborationMode === "PAIR" || activity.collaborationMode === "SMALL_GROUP") !== (l.roles.length > 0)) throw new Fail("learner.roles", "pair or group work names learner roles, and individual work does not");
}

export function parseActivityExperience(value: JsonValue | undefined, activity: Pick<ActivityDefinition, "identity" | "scaffolding" | "collaborationMode"> | null = null): ExperienceParse {
  try {
    const r = rec(value, "experience", ["schema", "profile", "learner", "teacher"]);
    if (r.schema !== ACTIVITY_EXPERIENCE_SCHEMA) throw new Fail("experience.schema", `expected ${ACTIVITY_EXPERIENCE_SCHEMA}`);
    const experience: ActivityExperienceV1 = { schema: ACTIVITY_EXPERIENCE_SCHEMA, profile: oneOf(r.profile, "experience.profile", EXPERIENCE_PROFILES), learner: learner(r.learner, "experience.learner"), teacher: teacher(r.teacher, "experience.teacher") };
    checkProfile(experience, activity);
    return { ok: true, experience };
  } catch (error) {
    if (error instanceof Fail) return { ok: false, issues: [{ path: error.path.startsWith("experience") ? error.path : `experience.${error.path}`, message: error.message }] };
    throw error;
  }
}

/** The experience an activity carries, parsed against its own definition; null when absent or invalid. */
export function activityExperienceOf(activity: ActivityDefinition): ActivityExperienceV1 | null {
  const raw = activity.extensions?.experience;
  if (raw === undefined) return null;
  const parsed = parseActivityExperience(raw, activity);
  return parsed.ok ? parsed.experience : null;
}

const visualCopy = (v: FractionVisual): FractionVisual =>
  v.kind === "STRIP"
    ? { kind: "STRIP", parts: v.parts, shaded: [...v.shaded], widths: v.widths ? [...v.widths] : null, label: v.label }
    : { kind: "SET", objects: v.objects, object: v.object, marked: [...v.marked], groups: v.groups, label: v.label };

const taskCopy = (t: ExperienceTask): ExperienceTask => {
  switch (t.kind) {
    case "SHADE_STRIP": return { kind: t.kind, parts: t.parts, ask: { numerator: t.ask.numerator, denominator: t.ask.denominator } };
    case "MARK_SET": return { kind: t.kind, objects: t.objects, object: t.object, groups: t.groups, ask: { numerator: t.ask.numerator, denominator: t.ask.denominator } };
    case "NAME_FRACTION": case "EQUAL_PARTS": return { kind: t.kind, visual: visualCopy(t.visual) };
    case "ON_PAPER": return { kind: t.kind, visual: t.visual ? visualCopy(t.visual) : null };
  }
};

/** Allow-list learner projection. Rebuilt field by field, so teacher fields cannot ride along. */
export function projectLearnerExperience(activity: ActivityDefinition): LearnerActivityExperience | null {
  const exp = activityExperienceOf(activity);
  if (!exp) return null;
  const l = exp.learner;
  return {
    schema: ACTIVITY_EXPERIENCE_SCHEMA,
    profile: exp.profile,
    goal: l.goal,
    intro: l.intro,
    purposeNote: l.purposeNote,
    materials: [...l.materials],
    roles: l.roles.map((r) => ({ role: r.role, text: r.text })),
    workedExamples: l.workedExamples.map((w) => ({ exampleKey: w.exampleKey, title: w.title, prompt: w.prompt, steps: w.steps.map((s) => ({ stepKey: s.stepKey, text: s.text, visual: visualCopy(s.visual) })) })),
    items: l.items.map((it) => ({ itemKey: it.itemKey, prompt: it.prompt, task: taskCopy(it.task), hints: [...it.hints] })),
    selfCheck: [...l.selfCheck],
    familyNote: l.familyNote,
    offline: { worksOffline: l.offline.worksOffline, note: l.offline.note },
  };
}
