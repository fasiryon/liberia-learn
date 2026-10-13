/**
 * Deterministic, fail-closed validator for ContentBundle V1.
 *
 * Accepts untrusted `unknown` input (authoring output, JSON from disk) and never throws for
 * malformed data. Every problem becomes a structured error with a stable code and path; a bundle
 * is returned only when there are none.
 */
import {
  ACTIVITY_KINDS,
  ASSESSMENT_ITEM_KINDS,
  ASSESSMENT_ROLES,
  CONTENT_BUNDLE_SCHEMA_VERSION,
  GOVERNED_ITEM_KINDS,
  type ContentBundleV1,
  type ContentBundleValidationCode,
  type ContentBundleValidationError,
  type ContentBundleValidationResult,
  type GovernedItemKind,
} from "./types";

export type ContentBundleValidationOptions = Readonly<{
  /** Optional registry check for toolkit ids (e.g. `isCanonicalToolId`). Kept injectable so this module stays pure. */
  isKnownToolId?: (toolId: string) => boolean;
}>;

// ─── Forbidden concepts ─────────────────────────────────────────────────────────────────────────

/**
 * Field names that would carry student state into the bundle. Matched case-insensitively with
 * separators removed, anywhere in the input (including `extensions`). `gradeLevel` (content grade)
 * and `placement` (lab placement in a lesson) are deliberately not listed.
 */
const STUDENT_STATE_KEYS = new Set([
  "studentid", "studentids", "learnerid", "learnerids", "userid", "pupilid",
  "attempt", "attempts", "attemptid", "attemptstate", "attemptnumber",
  "submission", "submissions", "submissionid", "submittedat",
  "score", "scores", "rawscore", "scaledscore", "pointsearned",
  "grades", "gradebook", "gradingresult", "teachergrade", "lettergrade", "gradedat",
  "mastery", "masterylevel", "masterystate", "masteryscore", "masteryestimate",
  "progress", "studentprogress", "progresspercent", "percentcomplete",
  "completion", "completed", "completedat", "completionstatus",
  "attendance", "attendancestatus",
  "placementdecision", "placementresult", "placementlevel",
  "recommendation", "recommendations", "recommendeditemid",
  "nextlesson", "nextlessonid", "nextitemid", "nextaction",
]);

/** Runtime/operational timestamps that must not enter (or perturb the hash of) a content contract. */
const RUNTIME_KEYS = new Set(["createdat", "updatedat", "fetchedat", "syncedat", "servedat", "generatedat", "lastaccessedat", "expiresat"]);

/** Inline answer material. Keys live in governed resources referenced by `secured.*ResourceId`. */
const INLINE_ANSWER_KEYS = new Set([
  "correctanswer", "correctanswers", "correctoption", "correctoptionid", "answerkey", "answers",
  "acceptableanswers", "solution", "solutions", "scoringkey", "markscheme", "workedsolution",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─── Allowed fields (strict, so unknown names cannot smuggle state) ─────────────────────────────

const KEYS = {
  bundle: ["schemaVersion", "identity", "curriculumAuthority", "sequence", "lessons", "activities", "assessments", "labs", "resources", "toolkitBindings", "learnerSupport", "renderings", "offline", "governance", "extensions"],
  identity: ["bundleId", "version", "title", "gradeLevel", "subject", "locale"],
  authority: ["releaseId", "releaseIdentity", "objectiveIds", "standardIds"],
  itemIdentity: ["itemId", "itemVersion", "itemKind"],
  unit: ["unitId", "unitVersion", "title", "order", "prerequisiteUnitIds", "entries"],
  entry: ["itemId", "order", "prerequisiteItemIds", "unlocksItemIds"],
  lesson: ["identity", "title", "objectiveIds", "estimatedMinutes", "resourceIds"],
  activity: ["identity", "title", "objectiveIds", "lessonItemIds", "scaffolding", "instructions", "resourceIds", "rubric", "expectedDurationMinutes", "collaborationMode", "evidenceIntent", "accessibility", "extensions"],
  step: ["stepId", "text", "resourceIds"],
  rubric: ["rubricId", "rubricVersion", "learnerVisibleCriteria", "scoringGuideResourceId"],
  accessibility: ["readingLevel", "supportsScreenReader", "supportsReadAloud", "requiresColorVision", "requiresFineMotor", "alternativeFormatResourceIds"],
  assessment: ["identity", "role", "title", "objectiveIds", "definition", "items", "learnerInstructions", "secured"],
  lab: ["identity", "linkId", "labId", "labVersion", "objectiveIds", "role", "placement", "authorityBasis"],
  resource: ["resourceId", "resourceVersion", "kind", "audience", "title", "locale", "assetId"],
  toolkit: ["toolId", "mode", "scope", "configuration", "internalConfiguration", "context"],
  support: ["remediation", "enrichment", "accommodations", "languageVariants"],
  supportLink: ["supportId", "objectiveIds", "itemIds", "resourceIds"],
  rendering: ["renderingId", "kind", "artifactVersion", "artifactSha256", "audience", "derivation", "sourceAuthority"],
  offline: ["packageable", "assets", "capabilityRestrictions", "reconnectRequirement"],
  asset: ["assetId", "assetVersion", "sha256", "byteSize", "mediaType", "audience"],
  governance: ["provenance", "reviewIds", "releaseRecordId", "reviewerNotes"],
} as const;

const AUDIENCES = ["LEARNER", "TEACHER", "SYSTEM"];
const RESOURCE_KINDS = ["DOCUMENT", "IMAGE", "AUDIO", "VIDEO", "WORKSHEET", "MANIPULATIVE", "TEACHER_NOTE", "ANSWER_KEY", "SCORING_GUIDE"];
const NON_LEARNER_RESOURCE_KINDS = new Set(["TEACHER_NOTE", "ANSWER_KEY", "SCORING_GUIDE"]);
const COLLABORATION_MODES = ["INDIVIDUAL", "PAIR", "SMALL_GROUP", "WHOLE_CLASS"];
const EVIDENCE_INTENTS = ["NONE", "PRACTICE_ONLY", "FORMATIVE", "SUMMATIVE_CANDIDATE"];
const EVIDENCE_FORMS = ["WRITTEN", "ORAL", "PHOTO", "ARTIFACT", "OBSERVATION", "DIGITAL_RESPONSE"];
const LAB_ROLES = ["CORE", "OPTIONAL", "ENRICHMENT", "REMEDIATION"];
const TOOL_MODES = ["REQUIRED", "OPTIONAL", "PROHIBITED"];
const ACCOMMODATION_KINDS = ["EXTENDED_TIME", "READ_ALOUD", "LARGE_PRINT", "REDUCED_LOAD", "ALTERNATE_FORMAT"];
const RENDERING_KINDS = ["TEXTBOOK", "WORKBOOK", "TEACHER_GUIDE", "ASSESSMENT_BOOK"];
const TEACHER_RENDERING_KINDS = new Set(["TEACHER_GUIDE", "ASSESSMENT_BOOK"]);
const CAPABILITY_RESTRICTIONS = ["NO_AI_TUTOR", "NO_LIVE_ASSESSMENT", "NO_SUMMATIVE_ASSESSMENT", "NO_LAB_EVIDENCE_FINALIZATION", "NO_SUBMISSION_FINALIZATION"];
const RECONNECT_REASONS = ["SUBMISSION_SYNC", "SUMMATIVE_ASSESSMENT", "EVIDENCE_RECONCILIATION"];
const SHA256 = /^[a-f0-9]{64}$/;
const MEDIA_TYPE = /^[a-z]+\/[a-z0-9.+-]+$/;

// ─── Helpers ────────────────────────────────────────────────────────────────────────────────────

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isConfigValue(value: unknown): boolean {
  return typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}

class Collector {
  readonly errors: ContentBundleValidationError[] = [];
  private readonly seen = new Set<string>();

  add(code: ContentBundleValidationCode, path: string, message: string): void {
    const key = `${code}|${path}|${message}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.errors.push({ code, path, message });
  }

  record(value: unknown, path: string): Rec | null {
    if (isRecord(value)) return value;
    this.add("malformed", path, "expected an object");
    return null;
  }

  array(value: unknown, path: string): readonly unknown[] {
    if (Array.isArray(value)) return value;
    this.add("malformed", path, "expected an array");
    return [];
  }

  keys(obj: Rec, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) this.add("unknown_field", `${path}.${key}`, `field "${key}" is not part of ContentBundle V1`);
    }
  }

  string(obj: Rec, key: string, path: string, code: ContentBundleValidationCode = "malformed"): string | null {
    const value = obj[key];
    if (isNonEmptyString(value)) return value;
    this.add(code, `${path}.${key}`, `${key} must be a non-empty string`);
    return null;
  }

  nullableString(obj: Rec, key: string, path: string): string | null {
    const value = obj[key];
    if (value === null) return null;
    if (isNonEmptyString(value)) return value;
    this.add("malformed", `${path}.${key}`, `${key} must be a non-empty string or null`);
    return null;
  }

  enumValue(obj: Rec, key: string, allowed: readonly string[], path: string, code: ContentBundleValidationCode = "malformed"): string | null {
    const value = obj[key];
    if (typeof value === "string" && allowed.includes(value)) return value;
    this.add(code, `${path}.${key}`, `${key} must be one of ${allowed.join(", ")}`);
    return null;
  }

  boolean(obj: Rec, key: string, path: string): void {
    if (typeof obj[key] !== "boolean") this.add("malformed", `${path}.${key}`, `${key} must be a boolean`);
  }

  number(obj: Rec, key: string, path: string, opts: { integer?: boolean; min?: number; code?: ContentBundleValidationCode } = {}): number | null {
    const value = obj[key];
    const ok = typeof value === "number" && Number.isFinite(value) && (!opts.integer || Number.isInteger(value)) && (opts.min === undefined || value >= opts.min);
    if (ok) return value as number;
    this.add(opts.code ?? "malformed", `${path}.${key}`, `${key} must be a${opts.integer ? "n integer" : " number"}${opts.min !== undefined ? ` >= ${opts.min}` : ""}`);
    return null;
  }

  /** Array of unique non-empty strings. */
  stringSet(obj: Rec, key: string, path: string): string[] {
    const values = this.array(obj[key], `${path}.${key}`);
    const out: string[] = [];
    values.forEach((value, index) => {
      if (!isNonEmptyString(value)) this.add("malformed", `${path}.${key}[${index}]`, "expected a non-empty string");
      else if (out.includes(value)) this.add("duplicate_id", `${path}.${key}[${index}]`, `"${value}" is listed more than once`);
      else out.push(value);
    });
    return out;
  }

  configRecord(obj: Rec, key: string, path: string): void {
    const value = this.record(obj[key], `${path}.${key}`);
    if (!value) return;
    for (const [entryKey, entry] of Object.entries(value)) {
      if (!isConfigValue(entry)) this.add("malformed", `${path}.${key}.${entryKey}`, "configuration values must be string, finite number or boolean");
    }
  }
}

function scanForbiddenKeys(c: Collector, value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbiddenKeys(c, entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    const at = `${path}.${key}`;
    if (STUDENT_STATE_KEYS.has(normalized)) c.add("student_state_forbidden", at, `"${key}" is student state; bundles define content, not what happened to a learner`);
    else if (RUNTIME_KEYS.has(normalized)) c.add("runtime_field_forbidden", at, `"${key}" is a runtime field and cannot be part of the content contract`);
    else if (INLINE_ANSWER_KEYS.has(normalized)) c.add("answer_key_inline", at, `"${key}" embeds answer material; reference a secured resource instead`);
    scanForbiddenKeys(c, entry, at);
  }
}

// ─── Validator ──────────────────────────────────────────────────────────────────────────────────

type ItemInfo = { kind: GovernedItemKind; path: string };

export function validateContentBundle(input: unknown, options: ContentBundleValidationOptions = {}): ContentBundleValidationResult {
  const c = new Collector();
  const root = "$";
  if (!isRecord(input)) {
    c.add("malformed", root, "bundle must be an object");
    return { ok: false, bundle: null, errors: c.errors };
  }

  scanForbiddenKeys(c, input, root);
  c.keys(input, KEYS.bundle, root);

  if (input.schemaVersion !== CONTENT_BUNDLE_SCHEMA_VERSION) {
    c.add("schema_version_unsupported", `${root}.schemaVersion`, `schemaVersion must be "${CONTENT_BUNDLE_SCHEMA_VERSION}"`);
  }

  // Identity
  const identity = c.record(input.identity, `${root}.identity`);
  if (identity) {
    const p = `${root}.identity`;
    c.keys(identity, KEYS.identity, p);
    c.string(identity, "bundleId", p, "identity_missing");
    c.string(identity, "version", p, "version_missing");
    c.string(identity, "title", p);
    c.number(identity, "gradeLevel", p, { integer: true, min: 1 });
    c.string(identity, "subject", p);
    c.string(identity, "locale", p);
  }

  // Curriculum authority
  const authorityObjectives = new Set<string>();
  const authority = c.record(input.curriculumAuthority, `${root}.curriculumAuthority`);
  if (authority) {
    const p = `${root}.curriculumAuthority`;
    c.keys(authority, KEYS.authority, p);
    c.string(authority, "releaseId", p, "authority_malformed");
    c.string(authority, "releaseIdentity", p, "authority_malformed");
    const objectives = c.stringSet(authority, "objectiveIds", p);
    if (Array.isArray(authority.objectiveIds) && authority.objectiveIds.length === 0) c.add("objectives_empty", `${p}.objectiveIds`, "a bundle must bind at least one curriculum objective");
    objectives.forEach((id) => authorityObjectives.add(id));
    c.stringSet(authority, "standardIds", p);
  }

  const checkObjectives = (obj: Rec, path: string) => {
    const ids = c.stringSet(obj, "objectiveIds", path);
    if (Array.isArray(obj.objectiveIds) && obj.objectiveIds.length === 0) c.add("objectives_empty", `${path}.objectiveIds`, "at least one objective binding is required");
    ids.forEach((id, index) => {
      if (authority && !authorityObjectives.has(id)) c.add("objective_not_in_authority", `${path}.objectiveIds[${index}]`, `objective "${id}" is not bound by curriculumAuthority`);
    });
  };

  // Offline assets (resources reference them)
  const assets = new Map<string, string>();
  const offline = c.record(input.offline, `${root}.offline`);
  if (offline) {
    const p = `${root}.offline`;
    c.keys(offline, KEYS.offline, p);
    c.boolean(offline, "packageable", p);
    c.array(offline.assets, `${p}.assets`).forEach((raw, index) => {
      const ap = `${p}.assets[${index}]`;
      const asset = c.record(raw, ap);
      if (!asset) return;
      c.keys(asset, KEYS.asset, ap);
      const assetId = c.string(asset, "assetId", ap, "offline_asset_malformed");
      c.string(asset, "assetVersion", ap, "offline_asset_malformed");
      if (typeof asset.sha256 !== "string" || !SHA256.test(asset.sha256)) c.add("offline_asset_malformed", `${ap}.sha256`, "sha256 must be 64 lowercase hex characters");
      c.number(asset, "byteSize", ap, { integer: true, min: 1, code: "offline_asset_malformed" });
      if (typeof asset.mediaType !== "string" || !MEDIA_TYPE.test(asset.mediaType)) c.add("offline_asset_malformed", `${ap}.mediaType`, "mediaType must be a type/subtype media type");
      const audience = c.enumValue(asset, "audience", AUDIENCES, ap, "offline_asset_malformed");
      if (assetId) {
        if (assets.has(assetId)) c.add("duplicate_id", `${ap}.assetId`, `asset "${assetId}" is declared more than once`);
        else assets.set(assetId, audience ?? "SYSTEM");
      }
    });
    const restrictions = c.array(offline.capabilityRestrictions, `${p}.capabilityRestrictions`);
    restrictions.forEach((value, index) => {
      if (typeof value !== "string" || !CAPABILITY_RESTRICTIONS.includes(value)) c.add("malformed", `${p}.capabilityRestrictions[${index}]`, `capability restriction must be one of ${CAPABILITY_RESTRICTIONS.join(", ")}`);
    });
    const reconnect = c.record(offline.reconnectRequirement, `${p}.reconnectRequirement`);
    if (reconnect) {
      c.array(reconnect.requiredFor, `${p}.reconnectRequirement.requiredFor`).forEach((value, index) => {
        if (typeof value !== "string" || !RECONNECT_REASONS.includes(value)) c.add("malformed", `${p}.reconnectRequirement.requiredFor[${index}]`, `reconnect reason must be one of ${RECONNECT_REASONS.join(", ")}`);
      });
      if (reconnect.maxOfflineDays !== null) c.number(reconnect, "maxOfflineDays", `${p}.reconnectRequirement`, { integer: true, min: 1 });
    }
  }

  // Resources
  const resources = new Map<string, { audience: string | null; kind: string | null }>();
  c.array(input.resources, `${root}.resources`).forEach((raw, index) => {
    const p = `${root}.resources[${index}]`;
    const resource = c.record(raw, p);
    if (!resource) return;
    c.keys(resource, KEYS.resource, p);
    const id = c.string(resource, "resourceId", p, "identity_missing");
    c.string(resource, "resourceVersion", p, "version_missing");
    const kind = c.enumValue(resource, "kind", RESOURCE_KINDS, p);
    const audience = c.enumValue(resource, "audience", AUDIENCES, p);
    c.string(resource, "title", p);
    c.string(resource, "locale", p);
    const assetId = c.nullableString(resource, "assetId", p);
    if (assetId && !assets.has(assetId)) c.add("reference_unknown", `${p}.assetId`, `asset "${assetId}" is not declared in offline.assets`);
    if (assetId && audience === "LEARNER" && assets.get(assetId) !== "LEARNER") c.add("resource_audience_conflict", `${p}.assetId`, "a learner resource cannot be carried by a non-learner asset");
    if (kind && audience === "LEARNER" && NON_LEARNER_RESOURCE_KINDS.has(kind)) c.add("resource_audience_conflict", `${p}.audience`, `${kind} resources cannot be learner-facing`);
    if (id) {
      if (resources.has(id)) c.add("duplicate_id", `${p}.resourceId`, `resource "${id}" is declared more than once`);
      else resources.set(id, { audience, kind });
    }
  });

  const checkResourceRefs = (obj: Rec, key: string, path: string) => {
    c.stringSet(obj, key, path).forEach((id, index) => {
      if (!resources.has(id)) c.add("reference_unknown", `${path}.${key}[${index}]`, `resource "${id}" is not declared in resources`);
    });
  };

  const checkSecuredResource = (obj: Rec, key: string, path: string, code: ContentBundleValidationCode) => {
    const id = c.nullableString(obj, key, path);
    if (!id) return;
    const resource = resources.get(id);
    if (!resource) c.add("reference_unknown", `${path}.${key}`, `resource "${id}" is not declared in resources`);
    else if (resource.audience === "LEARNER") c.add(code, `${path}.${key}`, `resource "${id}" is learner-facing and cannot hold secured material`);
  };

  // Governed items (shared id namespace across sections)
  const items = new Map<string, ItemInfo>();
  const checkIdentity = (obj: Rec, path: string, allowedKinds: readonly GovernedItemKind[]): { itemId: string | null; kind: GovernedItemKind | null } => {
    const ip = `${path}.identity`;
    const identityRecord = c.record(obj.identity, ip);
    if (!identityRecord) return { itemId: null, kind: null };
    c.keys(identityRecord, KEYS.itemIdentity, ip);
    const itemId = c.string(identityRecord, "itemId", ip, "identity_missing");
    c.string(identityRecord, "itemVersion", ip, "version_missing");
    const rawKind = identityRecord.itemKind;
    let kind: GovernedItemKind | null = null;
    if (typeof rawKind !== "string" || !(GOVERNED_ITEM_KINDS as readonly string[]).includes(rawKind)) {
      c.add("unknown_item_kind", `${ip}.itemKind`, `itemKind must be one of ${GOVERNED_ITEM_KINDS.join(", ")}`);
    } else if (!allowedKinds.includes(rawKind as GovernedItemKind)) {
      c.add("item_kind_section_mismatch", `${ip}.itemKind`, `${rawKind} is not allowed here (expected ${allowedKinds.join(", ")})`);
    } else {
      kind = rawKind as GovernedItemKind;
    }
    if (itemId) {
      const prior = items.get(itemId);
      if (prior) c.add("duplicate_id", `${ip}.itemId`, `item "${itemId}" is already declared at ${prior.path}`);
      else if (kind) items.set(itemId, { kind, path });
    }
    return { itemId, kind };
  };

  // Lessons
  const lessonEntries = c.array(input.lessons, `${root}.lessons`);
  lessonEntries.forEach((raw, index) => {
    const p = `${root}.lessons[${index}]`;
    const lesson = c.record(raw, p);
    if (!lesson) return;
    c.keys(lesson, KEYS.lesson, p);
    checkIdentity(lesson, p, ["LESSON"]);
    c.string(lesson, "title", p);
    checkObjectives(lesson, p);
    c.number(lesson, "estimatedMinutes", p, { integer: true, min: 1 });
    checkResourceRefs(lesson, "resourceIds", p);
  });
  const isLesson = (id: string) => items.get(id)?.kind === "LESSON";

  // Activities
  c.array(input.activities, `${root}.activities`).forEach((raw, index) => {
    const p = `${root}.activities[${index}]`;
    const activity = c.record(raw, p);
    if (!activity) return;
    c.keys(activity, KEYS.activity, p);
    checkIdentity(activity, p, ACTIVITY_KINDS);
    c.string(activity, "title", p);
    checkObjectives(activity, p);
    c.stringSet(activity, "lessonItemIds", p).forEach((id, i) => {
      if (!isLesson(id)) c.add("reference_unknown", `${p}.lessonItemIds[${i}]`, `lesson "${id}" is not declared in lessons`);
    });
    if (activity.scaffolding !== null && activity.scaffolding !== "GUIDED" && activity.scaffolding !== "INDEPENDENT") c.add("malformed", `${p}.scaffolding`, "scaffolding must be GUIDED, INDEPENDENT or null");
    const instructions = c.record(activity.instructions, `${p}.instructions`);
    if (instructions) {
      c.keys(instructions, ["learner", "teacher"], `${p}.instructions`);
      for (const audience of ["learner", "teacher"] as const) {
        const stepIds = new Set<string>();
        c.array(instructions[audience], `${p}.instructions.${audience}`).forEach((rawStep, i) => {
          const sp = `${p}.instructions.${audience}[${i}]`;
          const step = c.record(rawStep, sp);
          if (!step) return;
          c.keys(step, KEYS.step, sp);
          const stepId = c.string(step, "stepId", sp, "identity_missing");
          if (stepId && stepIds.has(stepId)) c.add("duplicate_id", `${sp}.stepId`, `step "${stepId}" is declared more than once`);
          if (stepId) stepIds.add(stepId);
          c.string(step, "text", sp);
          checkResourceRefs(step, "resourceIds", sp);
          if (audience === "learner") {
            for (const id of Array.isArray(step.resourceIds) ? step.resourceIds : []) {
              if (typeof id === "string" && resources.get(id) && resources.get(id)!.audience !== "LEARNER") c.add("resource_audience_conflict", `${sp}.resourceIds`, `learner instructions cannot cite non-learner resource "${id}"`);
            }
          }
        });
        if (audience === "learner" && Array.isArray(instructions.learner) && instructions.learner.length === 0) c.add("malformed", `${p}.instructions.learner`, "activities need at least one learner instruction");
      }
    }
    checkResourceRefs(activity, "resourceIds", p);
    if (activity.rubric !== null) {
      const rp = `${p}.rubric`;
      const rubric = c.record(activity.rubric, rp);
      if (rubric) {
        c.keys(rubric, KEYS.rubric, rp);
        c.string(rubric, "rubricId", rp, "identity_missing");
        c.string(rubric, "rubricVersion", rp, "version_missing");
        c.array(rubric.learnerVisibleCriteria, `${rp}.learnerVisibleCriteria`).forEach((value, i) => {
          if (!isNonEmptyString(value)) c.add("malformed", `${rp}.learnerVisibleCriteria[${i}]`, "expected a non-empty string");
        });
        checkSecuredResource(rubric, "scoringGuideResourceId", rp, "resource_audience_conflict");
      }
    }
    c.number(activity, "expectedDurationMinutes", p, { integer: true, min: 1 });
    c.enumValue(activity, "collaborationMode", COLLABORATION_MODES, p);
    const evidence = c.record(activity.evidenceIntent, `${p}.evidenceIntent`);
    if (evidence) {
      c.keys(evidence, ["kind", "forms"], `${p}.evidenceIntent`);
      c.enumValue(evidence, "kind", EVIDENCE_INTENTS, `${p}.evidenceIntent`);
      c.array(evidence.forms, `${p}.evidenceIntent.forms`).forEach((value, i) => {
        if (typeof value !== "string" || !EVIDENCE_FORMS.includes(value)) c.add("malformed", `${p}.evidenceIntent.forms[${i}]`, `evidence form must be one of ${EVIDENCE_FORMS.join(", ")}`);
      });
    }
    const a11y = c.record(activity.accessibility, `${p}.accessibility`);
    if (a11y) {
      const ap = `${p}.accessibility`;
      c.keys(a11y, KEYS.accessibility, ap);
      if (a11y.readingLevel !== null && !isNonEmptyString(a11y.readingLevel)) c.add("malformed", `${ap}.readingLevel`, "readingLevel must be a non-empty string or null");
      for (const key of ["supportsScreenReader", "supportsReadAloud", "requiresColorVision", "requiresFineMotor"]) c.boolean(a11y, key, ap);
      checkResourceRefs(a11y, "alternativeFormatResourceIds", ap);
    }
    if (activity.extensions !== undefined) c.record(activity.extensions, `${p}.extensions`);
  });

  // Assessments
  c.array(input.assessments, `${root}.assessments`).forEach((raw, index) => {
    const p = `${root}.assessments[${index}]`;
    const assessment = c.record(raw, p);
    if (!assessment) return;
    c.keys(assessment, KEYS.assessment, p);
    const { kind } = checkIdentity(assessment, p, ASSESSMENT_ITEM_KINDS);
    const role = c.enumValue(assessment, "role", ASSESSMENT_ROLES, p, "assessment_role_invalid");
    if (role && kind && (role === "QUIZ") !== (kind === "QUIZ")) c.add("item_kind_section_mismatch", `${p}.identity.itemKind`, "role QUIZ requires itemKind QUIZ, and itemKind QUIZ requires role QUIZ");
    c.string(assessment, "title", p);
    checkObjectives(assessment, p);
    const definition = isRecord(assessment.definition) ? assessment.definition : null;
    if (!definition) c.add("assessment_identity_missing", `${p}.definition`, "a governed AssessmentDefinition reference is required");
    else {
      c.keys(definition, ["definitionId", "definitionVersion"], `${p}.definition`);
      c.string(definition, "definitionId", `${p}.definition`, "assessment_identity_missing");
      c.string(definition, "definitionVersion", `${p}.definition`, "assessment_identity_missing");
    }
    const itemIds = new Set<string>();
    c.array(assessment.items, `${p}.items`).forEach((rawItem, i) => {
      const ip = `${p}.items[${i}]`;
      const item = isRecord(rawItem) ? rawItem : null;
      if (!item) {
        c.add("assessment_identity_missing", ip, "assessment item reference must be an object");
        return;
      }
      c.keys(item, ["assessmentItemId", "assessmentItemVersion"], ip);
      const id = c.string(item, "assessmentItemId", ip, "assessment_identity_missing");
      c.string(item, "assessmentItemVersion", ip, "assessment_identity_missing");
      if (id && itemIds.has(id)) c.add("duplicate_id", `${ip}.assessmentItemId`, `assessment item "${id}" is referenced more than once`);
      if (id) itemIds.add(id);
    });
    c.array(assessment.learnerInstructions, `${p}.learnerInstructions`).forEach((value, i) => {
      if (!isNonEmptyString(value)) c.add("malformed", `${p}.learnerInstructions[${i}]`, "expected a non-empty string");
    });
    const secured = c.record(assessment.secured, `${p}.secured`);
    if (secured) {
      c.keys(secured, ["answerKeyResourceId", "scoringGuideResourceId"], `${p}.secured`);
      checkSecuredResource(secured, "answerKeyResourceId", `${p}.secured`, "assessment_secret_exposed");
      checkSecuredResource(secured, "scoringGuideResourceId", `${p}.secured`, "assessment_secret_exposed");
    }
  });

  // Labs
  c.array(input.labs, `${root}.labs`).forEach((raw, index) => {
    const p = `${root}.labs[${index}]`;
    const lab = c.record(raw, p);
    if (!lab) return;
    c.keys(lab, KEYS.lab, p);
    checkIdentity(lab, p, ["LAB"]);
    c.string(lab, "linkId", p, "lab_binding_identity_missing");
    c.string(lab, "labId", p, "lab_binding_identity_missing");
    c.string(lab, "labVersion", p, "lab_binding_identity_missing");
    checkObjectives(lab, p);
    c.enumValue(lab, "role", LAB_ROLES, p);
    const placement = c.record(lab.placement, `${p}.placement`);
    if (placement) {
      c.keys(placement, ["lessonItemId", "sceneId"], `${p}.placement`);
      const lessonId = c.string(placement, "lessonItemId", `${p}.placement`, "lab_binding_identity_missing");
      if (lessonId && !isLesson(lessonId)) c.add("reference_unknown", `${p}.placement.lessonItemId`, `lesson "${lessonId}" is not declared in lessons`);
      c.nullableString(placement, "sceneId", `${p}.placement`);
    }
    if (lab.authorityBasis !== "GOVERNED_LINK") {
      c.add("lab_binding_authority_insufficient", `${p}.authorityBasis`, "labs bind only through a governed lesson↔lab link; showcase membership, standard-code matches and raw lab ids are not authority");
    }
  });

  // Sequence
  const sequence = c.record(input.sequence, `${root}.sequence`);
  if (sequence) {
    c.keys(sequence, ["units"], `${root}.sequence`);
    const units = c.array(sequence.units, `${root}.sequence.units`);
    const unitIds = new Set<string>();
    const unitOrders = new Map<number, string>();
    const sequenced = new Map<string, string>();
    const edges = new Map<string, Set<string>>();
    const addEdge = (from: string, to: string) => {
      if (!edges.has(from)) edges.set(from, new Set());
      edges.get(from)!.add(to);
    };
    const unitPrereqs: { path: string; ids: string[] }[] = [];
    units.forEach((rawUnit, ui) => {
      const up = `${root}.sequence.units[${ui}]`;
      const unit = c.record(rawUnit, up);
      if (!unit) return;
      c.keys(unit, KEYS.unit, up);
      const unitId = c.string(unit, "unitId", up, "identity_missing");
      c.string(unit, "unitVersion", up, "version_missing");
      c.string(unit, "title", up);
      if (unitId && unitIds.has(unitId)) c.add("duplicate_id", `${up}.unitId`, `unit "${unitId}" is declared more than once`);
      if (unitId) unitIds.add(unitId);
      const order = c.number(unit, "order", up, { integer: true, min: 0, code: "sequence_order_invalid" });
      if (order !== null) {
        if (unitOrders.has(order)) c.add("sequence_order_duplicate", `${up}.order`, `unit order ${order} is already used by ${unitOrders.get(order)}`);
        else unitOrders.set(order, up);
      }
      unitPrereqs.push({ path: up, ids: c.stringSet(unit, "prerequisiteUnitIds", up) });
      const entryOrders = new Map<number, string>();
      c.array(unit.entries, `${up}.entries`).forEach((rawEntry, ei) => {
        const ep = `${up}.entries[${ei}]`;
        const entry = c.record(rawEntry, ep);
        if (!entry) return;
        c.keys(entry, KEYS.entry, ep);
        const itemId = c.string(entry, "itemId", ep, "identity_missing");
        if (itemId) {
          if (!items.has(itemId)) c.add("sequence_reference_unknown", `${ep}.itemId`, `item "${itemId}" is not declared in this bundle`);
          if (sequenced.has(itemId)) c.add("duplicate_id", `${ep}.itemId`, `item "${itemId}" is already sequenced at ${sequenced.get(itemId)}`);
          else sequenced.set(itemId, ep);
        }
        const entryOrder = c.number(entry, "order", ep, { integer: true, min: 0, code: "sequence_order_invalid" });
        if (entryOrder !== null) {
          if (entryOrders.has(entryOrder)) c.add("sequence_order_duplicate", `${ep}.order`, `order ${entryOrder} is already used by ${entryOrders.get(entryOrder)}`);
          else entryOrders.set(entryOrder, ep);
        }
        for (const key of ["prerequisiteItemIds", "unlocksItemIds"] as const) {
          c.stringSet(entry, key, ep).forEach((ref, ri) => {
            if (!items.has(ref)) c.add("sequence_reference_unknown", `${ep}.${key}[${ri}]`, `item "${ref}" is not declared in this bundle`);
            else if (ref === itemId) c.add("sequence_cycle", `${ep}.${key}[${ri}]`, "an item cannot depend on or unlock itself");
            else if (itemId) key === "prerequisiteItemIds" ? addEdge(ref, itemId) : addEdge(itemId, ref);
          });
        }
      });
    });
    for (const { path, ids } of unitPrereqs) {
      ids.forEach((id, i) => {
        if (!unitIds.has(id)) c.add("sequence_reference_unknown", `${path}.prerequisiteUnitIds[${i}]`, `unit "${id}" is not declared in sequence`);
      });
    }
    const cycle = findCycle(edges);
    if (cycle) c.add("sequence_cycle", `${root}.sequence`, `prerequisite/unlock graph has a cycle: ${cycle.join(" -> ")}`);
  }

  // Toolkit bindings
  const bindings: { toolId: string; mode: string; scopeKey: string; path: string }[] = [];
  c.array(input.toolkitBindings, `${root}.toolkitBindings`).forEach((raw, index) => {
    const p = `${root}.toolkitBindings[${index}]`;
    const binding = c.record(raw, p);
    if (!binding) return;
    c.keys(binding, KEYS.toolkit, p);
    const toolId = c.string(binding, "toolId", p, "identity_missing");
    if (toolId && options.isKnownToolId && !options.isKnownToolId(toolId)) c.add("reference_unknown", `${p}.toolId`, `tool "${toolId}" is not in the toolkit registry`);
    const mode = c.enumValue(binding, "mode", TOOL_MODES, p);
    let scopeKey: string | null = null;
    const scope = c.record(binding.scope, `${p}.scope`);
    if (scope) {
      if (scope.kind === "BUNDLE") {
        c.keys(scope, ["kind"], `${p}.scope`);
        scopeKey = "BUNDLE";
      } else if (scope.kind === "ITEM") {
        c.keys(scope, ["kind", "itemId"], `${p}.scope`);
        const itemId = c.string(scope, "itemId", `${p}.scope`, "identity_missing");
        if (itemId && !items.has(itemId)) c.add("reference_unknown", `${p}.scope.itemId`, `item "${itemId}" is not declared in this bundle`);
        if (itemId) scopeKey = `ITEM:${itemId}`;
      } else c.add("malformed", `${p}.scope.kind`, "scope.kind must be BUNDLE or ITEM");
    }
    c.configRecord(binding, "configuration", p);
    c.configRecord(binding, "internalConfiguration", p);
    c.nullableString(binding, "context", p);
    if (toolId && mode && scopeKey) bindings.push({ toolId, mode, scopeKey, path: p });
  });
  const bindingKeys = new Map<string, string>();
  for (const binding of bindings) {
    const key = `${binding.toolId}|${binding.scopeKey}`;
    if (bindingKeys.has(key)) c.add("toolkit_binding_duplicate", binding.path, `tool "${binding.toolId}" is already bound for ${binding.scopeKey} at ${bindingKeys.get(key)}`);
    else bindingKeys.set(key, binding.path);
  }
  for (const prohibited of bindings.filter((b) => b.mode === "PROHIBITED")) {
    for (const other of bindings) {
      if (other === prohibited || other.toolId !== prohibited.toolId || other.mode === "PROHIBITED") continue;
      // A bundle-wide prohibition contradicts any allowance; an item prohibition contradicts a
      // requirement at the same item or bundle-wide. An item may narrow a bundle-wide OPTIONAL.
      const collides =
        prohibited.scopeKey === "BUNDLE" ||
        other.scopeKey === prohibited.scopeKey ||
        (other.scopeKey === "BUNDLE" && other.mode === "REQUIRED");
      if (collides) c.add("toolkit_collision", prohibited.path, `tool "${prohibited.toolId}" is PROHIBITED for ${prohibited.scopeKey} but ${other.mode} for ${other.scopeKey} at ${other.path}`);
    }
  }

  // Learner support
  const support = c.record(input.learnerSupport, `${root}.learnerSupport`);
  if (support) {
    const sp = `${root}.learnerSupport`;
    c.keys(support, KEYS.support, sp);
    const supportIds = new Set<string>();
    for (const key of ["remediation", "enrichment"] as const) {
      c.array(support[key], `${sp}.${key}`).forEach((raw, index) => {
        const p = `${sp}.${key}[${index}]`;
        const link = c.record(raw, p);
        if (!link) return;
        c.keys(link, KEYS.supportLink, p);
        const id = c.string(link, "supportId", p, "identity_missing");
        if (id && supportIds.has(id)) c.add("duplicate_id", `${p}.supportId`, `support "${id}" is declared more than once`);
        if (id) supportIds.add(id);
        checkObjectives(link, p);
        c.stringSet(link, "itemIds", p).forEach((ref, i) => {
          if (!items.has(ref)) c.add("reference_unknown", `${p}.itemIds[${i}]`, `item "${ref}" is not declared in this bundle`);
        });
        checkResourceRefs(link, "resourceIds", p);
      });
    }
    const accommodationIds = new Set<string>();
    c.array(support.accommodations, `${sp}.accommodations`).forEach((raw, index) => {
      const p = `${sp}.accommodations[${index}]`;
      const accommodation = c.record(raw, p);
      if (!accommodation) return;
      c.keys(accommodation, ["accommodationId", "kind", "presentation"], p);
      const id = c.string(accommodation, "accommodationId", p, "identity_missing");
      if (id && accommodationIds.has(id)) c.add("duplicate_id", `${p}.accommodationId`, `accommodation "${id}" is declared more than once`);
      if (id) accommodationIds.add(id);
      c.enumValue(accommodation, "kind", ACCOMMODATION_KINDS, p);
      c.configRecord(accommodation, "presentation", p);
    });
    c.array(support.languageVariants, `${sp}.languageVariants`).forEach((raw, index) => {
      const p = `${sp}.languageVariants[${index}]`;
      const variant = c.record(raw, p);
      if (!variant) return;
      c.keys(variant, ["locale", "itemId", "resourceIds"], p);
      c.string(variant, "locale", p);
      const itemId = c.string(variant, "itemId", p, "identity_missing");
      if (itemId && !items.has(itemId)) c.add("reference_unknown", `${p}.itemId`, `item "${itemId}" is not declared in this bundle`);
      checkResourceRefs(variant, "resourceIds", p);
    });
  }

  // Renderings (derived only)
  const renderingIds = new Set<string>();
  c.array(input.renderings, `${root}.renderings`).forEach((raw, index) => {
    const p = `${root}.renderings[${index}]`;
    const rendering = c.record(raw, p);
    if (!rendering) return;
    c.keys(rendering, KEYS.rendering, p);
    const id = c.string(rendering, "renderingId", p, "identity_missing");
    if (id && renderingIds.has(id)) c.add("duplicate_id", `${p}.renderingId`, `rendering "${id}" is declared more than once`);
    if (id) renderingIds.add(id);
    const kind = c.enumValue(rendering, "kind", RENDERING_KINDS, p);
    c.string(rendering, "artifactVersion", p, "version_missing");
    if (typeof rendering.artifactSha256 !== "string" || !SHA256.test(rendering.artifactSha256)) c.add("malformed", `${p}.artifactSha256`, "artifactSha256 must be 64 lowercase hex characters");
    const audience = c.enumValue(rendering, "audience", AUDIENCES, p);
    if (kind && audience === "LEARNER" && TEACHER_RENDERING_KINDS.has(kind)) c.add("resource_audience_conflict", `${p}.audience`, `${kind} renderings cannot be learner-facing`);
    if (rendering.derivation !== "DERIVED" || rendering.sourceAuthority !== false) {
      c.add("rendering_claims_authority", p, "renderings are derived artifacts and cannot be a source of curriculum authority");
    }
  });

  // Governance (references only)
  const governance = c.record(input.governance, `${root}.governance`);
  if (governance) {
    const gp = `${root}.governance`;
    c.keys(governance, KEYS.governance, gp);
    const provenance = c.record(governance.provenance, `${gp}.provenance`);
    if (provenance) {
      c.keys(provenance, ["sourceIds", "generatorRunId"], `${gp}.provenance`);
      c.stringSet(provenance, "sourceIds", `${gp}.provenance`);
      c.nullableString(provenance, "generatorRunId", `${gp}.provenance`);
    }
    c.stringSet(governance, "reviewIds", gp);
    c.nullableString(governance, "releaseRecordId", gp);
    c.array(governance.reviewerNotes, `${gp}.reviewerNotes`).forEach((value, i) => {
      if (typeof value !== "string") c.add("malformed", `${gp}.reviewerNotes[${i}]`, "expected a string");
    });
  }

  if (input.extensions !== undefined) c.record(input.extensions, `${root}.extensions`);

  if (c.errors.length > 0) return { ok: false, bundle: null, errors: c.errors };
  return { ok: true, bundle: input as unknown as ContentBundleV1, errors: [] };
}

/** Deterministic cycle search over the item dependency graph (nodes visited in sorted order). */
function findCycle(edges: ReadonlyMap<string, ReadonlySet<string>>): string[] | null {
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const visit = (node: string): string[] | null => {
    if (state.get(node) === "done") return null;
    if (state.get(node) === "visiting") return [...stack.slice(stack.indexOf(node)), node];
    state.set(node, "visiting");
    stack.push(node);
    for (const next of [...(edges.get(node) ?? [])].sort()) {
      const found = visit(next);
      if (found) return found;
    }
    stack.pop();
    state.set(node, "done");
    return null;
  };
  for (const node of [...edges.keys()].sort()) {
    const found = visit(node);
    if (found) return found;
  }
  return null;
}
