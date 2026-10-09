/**
 * Strict learner-safe rebuild of a LessonExperience (Codex second-pass P1-2).
 *
 * Every field the player reads is re-picked by name and checked against its primitive type; every
 * collection is checked element by element. Anything unexpected — an object where a string belongs,
 * a key-bearing object inside keyPoints, an unknown enum — throws, so the caller marks the lesson
 * not student-ready instead of stringifying or forwarding it. Unknown keys never survive the rebuild.
 */
import { SCENE_TYPES, LESSON_EXPERIENCE_CONTRACT_VERSION, type AgeBand, type LessonExperience, type Scene, type SceneInteraction } from "./types";

export class LearnerProjectionError extends Error {}

/** Answer/teacher-bearing key names that may never appear anywhere in a learner projection. */
export const LEARNER_SECRET_KEYS = Object.freeze([
  "answer", "answerkey", "correctanswer", "correctindex", "expectedanswer", "expectedresponse",
  "solution", "solutions", "markscheme", "scoringrubric", "rubric", "teachernotes", "teacherguide", "teacheronly",
  "hiddenanswer", "masterykey", "formativekey", "expectedoptionid", "explanationforteacher", "misconceptionnotes",
]);

const AGE_BANDS: readonly AgeBand[] = ["EARLY_PRIMARY", "UPPER_PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"];
const AUTHORITY_STATUSES = ["APPROVED_RELEASE", "CURRICULUM_V2_DRAFT", "PROTOTYPE_FIXTURE", "LEGACY_UNGOVERNED"] as const;
const MEDIA_KINDS = ["IMAGE", "DIAGRAM", "VIDEO", "AUDIO"] as const;
const OFFLINE_MODES = ["FULL", "DEGRADED", "ONLINE_ONLY"] as const;
const EVIDENCE_KINDS = ["FORMATIVE_OBSERVATION", "LAB_OBSERVATION", "REFLECTION", "MASTERY_RESPONSE"] as const;
const COMPLETION_KINDS = ["VIEWED", "ALL_STEPS_REVEALED", "ALL_ANSWERED", "LAB_RETURNED_OR_FALLBACK", "ALL_RESPONSES_WRITTEN"] as const;

const fail = (path: string): never => { throw new LearnerProjectionError(`learner_projection_malformed:${path}`); };

function obj(value: unknown, path: string): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : fail(path);
}
function str(value: unknown, path: string): string {
  // A stringified object is evidence the source held a structure where text belongs.
  return typeof value === "string" && !value.includes("[object Object]") ? value : fail(path);
}
function optStr(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : str(value, path);
}
function num(value: unknown, path: string): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fail(path);
}
function bool(value: unknown, path: string): boolean {
  return typeof value === "boolean" ? value : fail(path);
}
function arr(value: unknown, path: string): unknown[] {
  return Array.isArray(value) ? value : fail(path);
}
function strs(value: unknown, path: string): string[] {
  return arr(value, path).map((entry, index) => str(entry, `${path}[${index}]`));
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fail(path);
}

function interaction(value: unknown, path: string): SceneInteraction {
  const source = obj(value, path);
  switch (source.kind) {
    case "NONE": return { kind: "NONE" };
    case "DIAGRAM_REVEAL": return {
      kind: "DIAGRAM_REVEAL",
      diagramId: str(source.diagramId, `${path}.diagramId`),
      steps: arr(source.steps, `${path}.steps`).map((step, index) => {
        const s = obj(step, `${path}.steps[${index}]`);
        return { id: str(s.id, `${path}.steps[${index}].id`), label: str(s.label, `${path}.steps[${index}].label`), description: str(s.description, `${path}.steps[${index}].description`) };
      }),
    };
    case "MULTIPLE_CHOICE": return {
      kind: "MULTIPLE_CHOICE",
      items: arr(source.items, `${path}.items`).map((item, index) => {
        const p = `${path}.items[${index}]`;
        const i = obj(item, p);
        const feedback = obj(i.feedback, `${p}.feedback`);
        const correctIndex = num(i.correctIndex, `${p}.correctIndex`);
        if (!Number.isInteger(correctIndex)) fail(`${p}.correctIndex`);
        return {
          id: str(i.id, `${p}.id`),
          prompt: str(i.prompt, `${p}.prompt`),
          options: strs(i.options, `${p}.options`),
          // Formative keys ship to the client by design (Phase A contract); validated as an integer only.
          correctIndex,
          feedback: { correct: str(feedback.correct, `${p}.feedback.correct`), incorrect: str(feedback.incorrect, `${p}.feedback.incorrect`) },
          ...(i.optionFeedback !== undefined ? { optionFeedback: strs(i.optionFeedback, `${p}.optionFeedback`) } : {}),
        };
      }),
    };
    case "FREE_RESPONSE": return {
      kind: "FREE_RESPONSE",
      prompts: arr(source.prompts, `${path}.prompts`).map((prompt, index) => {
        const p = obj(prompt, `${path}.prompts[${index}]`);
        return { id: str(p.id, `${path}.prompts[${index}].id`), prompt: str(p.prompt, `${path}.prompts[${index}].prompt`), minLength: num(p.minLength, `${path}.prompts[${index}].minLength`) };
      }),
    };
    case "LAB_LAUNCH": return { kind: "LAB_LAUNCH", linkId: str(source.linkId, `${path}.linkId`) };
    case "ASSESSMENT_HANDOFF": {
      const a = obj(source.assessment, `${path}.assessment`);
      if (a.player !== "ASSESSMENT_PLAYER_V2" || a.scoring !== "SERVER_AUTHORITY") fail(`${path}.assessment`);
      return {
        kind: "ASSESSMENT_HANDOFF",
        assessment: {
          assessmentId: str(a.assessmentId, `${path}.assessment.assessmentId`),
          assessmentVersion: str(a.assessmentVersion, `${path}.assessment.assessmentVersion`),
          player: "ASSESSMENT_PLAYER_V2",
          scoring: "SERVER_AUTHORITY",
          objectiveIds: strs(a.objectiveIds, `${path}.assessment.objectiveIds`),
          // Mastery items carry no key of any kind: only the reference, prompt and options.
          items: arr(a.items, `${path}.assessment.items`).map((item, index) => {
            const p = `${path}.assessment.items[${index}]`;
            const i = obj(item, p);
            return { itemId: str(i.itemId, `${p}.itemId`), itemVersion: str(i.itemVersion, `${p}.itemVersion`), prompt: str(i.prompt, `${p}.prompt`), options: strs(i.options, `${p}.options`) };
          }),
        },
      };
    }
    default: return fail(`${path}.kind`);
  }
}

function scene(value: unknown, index: number): Scene {
  const path = `scenes[${index}]`;
  const s = obj(value, path);
  const content = obj(s.content, `${path}.content`);
  const ageVariants = content.ageVariants === undefined ? undefined : Object.fromEntries(
    Object.entries(obj(content.ageVariants, `${path}.content.ageVariants`)).map(([band, variant]) => {
      const p = `${path}.content.ageVariants.${band}`;
      oneOf(band, AGE_BANDS, p);
      const v = obj(variant, p);
      return [band, { body: str(v.body, `${p}.body`), ...(v.keyPoints !== undefined ? { keyPoints: strs(v.keyPoints, `${p}.keyPoints`) } : {}) }];
    }),
  );
  const tools = obj(s.tools, `${path}.tools`);
  const accessibility = obj(s.accessibility, `${path}.accessibility`);
  const offline = obj(s.offline, `${path}.offline`);
  const evidence = obj(s.evidence, `${path}.evidence`);
  const completion = obj(s.completion, `${path}.completion`);
  return {
    id: str(s.id, `${path}.id`),
    type: oneOf(s.type, SCENE_TYPES, `${path}.type`),
    title: str(s.title, `${path}.title`),
    objectiveIds: strs(s.objectiveIds, `${path}.objectiveIds`),
    content: {
      body: str(content.body, `${path}.content.body`),
      ...(content.keyPoints !== undefined ? { keyPoints: strs(content.keyPoints, `${path}.content.keyPoints`) } : {}),
      ...(ageVariants ? { ageVariants } : {}),
    },
    interaction: interaction(s.interaction, `${path}.interaction`),
    ...(s.media !== undefined ? {
      media: arr(s.media, `${path}.media`).map((media, i) => {
        const p = `${path}.media[${i}]`;
        const m = obj(media, p);
        const transcript = optStr(m.transcript, `${p}.transcript`);
        const captionsRef = optStr(m.captionsRef, `${p}.captionsRef`);
        return {
          kind: oneOf(m.kind, MEDIA_KINDS, `${p}.kind`), ref: str(m.ref, `${p}.ref`), alt: str(m.alt, `${p}.alt`),
          ...(transcript !== undefined ? { transcript } : {}), ...(captionsRef !== undefined ? { captionsRef } : {}),
          ...(m.offlineBytes !== undefined ? { offlineBytes: num(m.offlineBytes, `${p}.offlineBytes`) } : {}),
        };
      }),
    } : {}),
    tools: { allowed: strs(tools.allowed, `${path}.tools.allowed`), prohibited: strs(tools.prohibited, `${path}.tools.prohibited`) },
    accessibility: {
      textAlternative: str(accessibility.textAlternative, `${path}.accessibility.textAlternative`),
      keyboardOperable: bool(accessibility.keyboardOperable, `${path}.accessibility.keyboardOperable`),
      reducedMotionSafe: bool(accessibility.reducedMotionSafe, `${path}.accessibility.reducedMotionSafe`),
      captionsRequired: bool(accessibility.captionsRequired, `${path}.accessibility.captionsRequired`),
    },
    offline: { mode: oneOf(offline.mode, OFFLINE_MODES, `${path}.offline.mode`), fallback: str(offline.fallback, `${path}.offline.fallback`) },
    evidence: evidence.kind === "NONE"
      ? { kind: "NONE" }
      : { kind: oneOf(evidence.kind, EVIDENCE_KINDS, `${path}.evidence.kind`), evidenceType: str(evidence.evidenceType, `${path}.evidence.evidenceType`) as never, objectiveIds: strs(evidence.objectiveIds, `${path}.evidence.objectiveIds`) },
    completion: { kind: oneOf(completion.kind, COMPLETION_KINDS, `${path}.completion.kind`) } as Scene["completion"],
  };
}

export function rebuildLearnerExperience(value: unknown): LessonExperience {
  const e = obj(value, "experience");
  if (e.contractVersion !== LESSON_EXPERIENCE_CONTRACT_VERSION) fail("contractVersion");
  const authority = obj(e.authority, "authority");
  const offline = obj(e.offline, "offline");
  const releaseId = authority.releaseId === null ? null : str(authority.releaseId, "authority.releaseId");
  const releaseIdentity: string | null | undefined = authority.releaseIdentity === undefined ? undefined
    : authority.releaseIdentity === null ? null : str(authority.releaseIdentity, "authority.releaseIdentity");
  const rebuilt: LessonExperience = {
    contractVersion: LESSON_EXPERIENCE_CONTRACT_VERSION,
    id: str(e.id, "id"),
    version: str(e.version, "version"),
    title: str(e.title, "title"),
    subject: str(e.subject, "subject"),
    grade: num(e.grade, "grade"),
    ageBand: oneOf(e.ageBand, AGE_BANDS, "ageBand"),
    authority: {
      status: oneOf(authority.status, AUTHORITY_STATUSES, "authority.status"),
      note: str(authority.note, "authority.note"),
      candidateContentIds: strs(authority.candidateContentIds, "authority.candidateContentIds"),
      releaseId,
      ...(releaseIdentity !== undefined ? { releaseIdentity } : {}),
    },
    objectives: arr(e.objectives, "objectives").map((objective, index) => {
      const o = obj(objective, `objectives[${index}]`);
      return { id: str(o.id, `objectives[${index}].id`), statement: str(o.statement, `objectives[${index}].statement`), conceptId: str(o.conceptId, `objectives[${index}].conceptId`), standardCodes: strs(o.standardCodes, `objectives[${index}].standardCodes`), skillIds: strs(o.skillIds, `objectives[${index}].skillIds`) };
    }),
    scenes: arr(e.scenes, "scenes").map(scene),
    offline: { packageable: bool(offline.packageable, "offline.packageable"), requiredAssets: strs(offline.requiredAssets, "offline.requiredAssets") },
  };
  assertNoLearnerSecretKeys(rebuilt);
  return rebuilt;
}

/**
 * Defence in depth: no secret-named key anywhere in a learner projection. The single permitted
 * exception is the formative `correctIndex` on a MULTIPLE_CHOICE item (instant offline feedback).
 */
export function assertNoLearnerSecretKeys(value: unknown, path = "$"): void {
  if (Array.isArray(value)) { value.forEach((entry, index) => assertNoLearnerSecretKeys(entry, `${path}[${index}]`)); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    const formativeKey = key === "correctIndex" && /\.scenes\[\d+\]\.interaction\.items\[\d+\]$/.test(path);
    if (LEARNER_SECRET_KEYS.includes(normalized) && !formativeKey) throw new LearnerProjectionError(`learner_projection_secret_key:${path}.${key}`);
    assertNoLearnerSecretKeys(child, `${path}.${key}`);
  }
}
