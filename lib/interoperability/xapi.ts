import { createHash, createHmac } from "crypto";

export const XAPI_VERSION = "1.0.3" as const;
export const XAPI_STATEMENT_VERSION = "1.0.0" as const;
export const XAPI_ACTOR_HOME_PAGE = "https://liberialearn.org/xapi/actors";

const XAPI_BASE = "https://liberialearn.org/xapi";
const STATEMENT_NAMESPACE = "bc6e5b4e-9f39-5ad0-82d8-1e6b9d6c662a";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ISO_DURATION_PATTERN = /^P(?=\d|T\d)(?:\d+(?:\.\d+)?Y)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?W)?(?:\d+(?:\.\d+)?D)?(?:T(?=\d)(?:\d+(?:\.\d+)?H)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?S)?)?$/;

const VERBS: Record<string, { id: string; display: string }> = {
  answered: { id: "http://adlnet.gov/expapi/verbs/answered", display: "answered" },
  attempted: { id: "http://adlnet.gov/expapi/verbs/attempted", display: "attempted" },
  completed: { id: "http://adlnet.gov/expapi/verbs/completed", display: "completed" },
  experienced: { id: "http://adlnet.gov/expapi/verbs/experienced", display: "experienced" },
  failed: { id: "http://adlnet.gov/expapi/verbs/failed", display: "failed" },
  passed: { id: "http://adlnet.gov/expapi/verbs/passed", display: "passed" },
};

const EXTENSIONS = {
  aiAssistUsed: `${XAPI_BASE}/extensions/ai-assist-used`,
  assessmentVersion: `${XAPI_BASE}/extensions/assessment-version`,
  attempts: `${XAPI_BASE}/extensions/attempts`,
  calculationVersion: `${XAPI_BASE}/extensions/calculation-version`,
  curriculumVersion: `${XAPI_BASE}/extensions/curriculum-version`,
  gradeLevel: `${XAPI_BASE}/extensions/grade-level`,
  isReplay: `${XAPI_BASE}/extensions/is-replay`,
  promptVersion: `${XAPI_BASE}/extensions/prompt-version`,
  replayOfStatement: `${XAPI_BASE}/extensions/replay-of-statement`,
  replaySequence: `${XAPI_BASE}/extensions/replay-sequence`,
  sourceModel: `${XAPI_BASE}/extensions/source-model`,
} as const;

const ALLOWED_CONTEXT_EXTENSIONS = new Set<string>([
  EXTENSIONS.assessmentVersion,
  EXTENSIONS.calculationVersion,
  EXTENSIONS.curriculumVersion,
  EXTENSIONS.gradeLevel,
  EXTENSIONS.isReplay,
  EXTENSIONS.promptVersion,
  EXTENSIONS.replayOfStatement,
  EXTENSIONS.replaySequence,
  EXTENSIONS.sourceModel,
]);
const ALLOWED_RESULT_EXTENSIONS = new Set<string>([
  EXTENSIONS.aiAssistUsed,
  EXTENSIONS.attempts,
]);
const ALLOWED_ACTIVITY_KINDS = new Set([
  "assessment",
  "assignment",
  "content",
  "course",
  "exam",
  "lab",
  "lesson",
  "module",
  "page",
  "quiz",
]);

export interface XapiAgent {
  objectType: "Agent";
  account: {
    homePage: string;
    name: string;
  };
}

export interface XapiStatement {
  id: string;
  actor: XapiAgent;
  verb: {
    id: string;
    display: { "en-US": string };
  };
  object: {
    objectType: "Activity";
    id: string;
    definition: {
      type: string;
      name: { "en-US": string };
    };
  };
  result?: {
    score?: { scaled: number };
    success?: boolean;
    completion?: boolean;
    duration?: string;
    extensions?: Record<string, boolean | number | string>;
  };
  context: {
    platform: "LiberiaLearn";
    extensions: Record<string, boolean | number | string>;
  };
  timestamp: string;
  version: typeof XAPI_STATEMENT_VERSION;
}

export interface LearningEventXapiSource {
  id: string;
  eventType: string;
  occurredAt: Date | string;
  originalOccurredAt?: Date | string | null;
  userId?: string | null;
  studentId?: string | null;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  contentId?: string | null;
  lessonId?: string | null;
  status?: string | null;
  curriculumVersion?: string | null;
  promptVersion?: string | null;
  assessmentVersion?: string | null;
  calculationVersion?: string | null;
  replayOfEventId?: string | null;
  replaySequence?: number | null;
  isReplay?: boolean | null;
  metadata?: unknown;
  qualityMarkers?: unknown;
}

export interface StudentPerformanceEventXapiSource {
  id: string;
  studentId: string;
  lessonId?: string | null;
  subject: string;
  gradeLevel: number;
  eventType: string;
  score: number;
  durationSeconds: number;
  attempts?: number | null;
  aiAssistUsed?: boolean | null;
  createdAt: Date | string;
}

export interface XapiMappingOptions {
  pseudonymSecret: string;
  actorIdentifier?: string;
  actorHomePage?: string;
}

export interface XapiValidationResult {
  valid: boolean;
  errors: string[];
}

function uuidBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function formatUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function deterministicStatementId(sourceModel: "LearningEvent" | "StudentPerformanceEvent", rowId: string): string {
  if (!rowId.trim()) throw new Error("A source row id is required");

  const digest = createHash("sha1")
    .update(uuidBytes(STATEMENT_NAMESPACE))
    .update(`${sourceModel}:${rowId}`, "utf8")
    .digest()
    .subarray(0, 16);

  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  return formatUuid(digest);
}

export function pseudonymizeXapiActor(identifier: string, secret: string): string {
  if (!identifier.trim()) throw new Error("An actor identifier is required");
  if (secret.length < 16) throw new Error("The xAPI pseudonym secret must be at least 16 characters");

  return createHmac("sha256", secret)
    .update(`liberialearn:xapi:actor:${identifier}`, "utf8")
    .digest("hex");
}

export function secondsToIsoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error("Duration seconds must be a finite non-negative number");
  }
  const rounded = Math.round(seconds * 100) / 100;
  return `PT${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0+$/, "")}S`;
}

function toTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid event timestamp is required");
  return date.toISOString();
}

function isIri(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || /\s/.test(value)) return false;
  try {
    return Boolean(new URL(value).protocol);
  } catch {
    return false;
  }
}

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function mapVerb(eventType: string, status?: string | null) {
  const normalized = `${eventType} ${status ?? ""}`.toLowerCase();
  const key = normalized.includes("fail")
    ? "failed"
    : normalized.includes("pass")
      ? "passed"
      : normalized.includes("complete")
        ? "completed"
        : normalized.includes("answer") || normalized.includes("quiz") || normalized.includes("exam")
          ? "answered"
          : normalized.includes("attempt") || normalized.includes("practice")
            ? "attempted"
            : "experienced";
  return VERBS[key];
}

function safeActivityKind(value?: string | null): string {
  if (!nonEmpty(value)) return "learning-activity";
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return ALLOWED_ACTIVITY_KINDS.has(normalized) ? normalized : "learning-activity";
}

function activityId(kind: string, identifier: string): string {
  const opaqueId = createHash("sha256").update(`${kind}:${identifier}`, "utf8").digest("hex").slice(0, 32);
  return `${XAPI_BASE}/activities/${encodeURIComponent(kind)}/${opaqueId}`;
}

function makeActor(identifier: string, options: XapiMappingOptions): XapiAgent {
  const homePage = options.actorHomePage ?? XAPI_ACTOR_HOME_PAGE;
  if (!isIri(homePage)) throw new Error("The xAPI actor homePage must be an absolute IRI");
  return {
    objectType: "Agent",
    account: {
      homePage,
      name: pseudonymizeXapiActor(identifier, options.pseudonymSecret),
    },
  };
}

function compactExtensions(
  values: Array<[string, boolean | number | string | null | undefined]>
): Record<string, boolean | number | string> {
  return Object.fromEntries(values.filter((entry): entry is [string, boolean | number | string] => {
    const value = entry[1];
    return value !== null && value !== undefined && value !== "";
  }));
}

function learningResult(event: LearningEventXapiSource): XapiStatement["result"] {
  const status = event.status?.toLowerCase();
  const eventType = event.eventType.toLowerCase();
  const success = status === "passed" || status === "success" || status === "succeeded"
    ? true
    : status === "failed" || status === "failure"
      ? false
      : undefined;
  const completion = eventType.includes("complete") || status === "completed" ? true : undefined;

  if (success === undefined && completion === undefined) return undefined;
  return {
    ...(success === undefined ? {} : { success }),
    ...(completion === undefined ? {} : { completion }),
  };
}

export function mapLearningEventToXapi(
  event: LearningEventXapiSource,
  options: XapiMappingOptions
): XapiStatement {
  const actorIdentifier = options.actorIdentifier ?? event.studentId ?? event.userId ?? event.actorId;
  if (!nonEmpty(actorIdentifier)) throw new Error("LearningEvent has no actor identifier");
  if (!nonEmpty(event.eventType)) throw new Error("LearningEvent has no event type");

  const kind = safeActivityKind(event.targetType ?? (event.lessonId ? "lesson" : event.contentId ? "content" : undefined));
  const objectIdentifier = event.lessonId ?? event.contentId ?? event.targetId ?? event.id;
  const verb = mapVerb(event.eventType, event.status);
  const extensions = compactExtensions([
    [EXTENSIONS.sourceModel, "LearningEvent"],
    [EXTENSIONS.curriculumVersion, event.curriculumVersion],
    [EXTENSIONS.promptVersion, event.promptVersion],
    [EXTENSIONS.assessmentVersion, event.assessmentVersion],
    [EXTENSIONS.calculationVersion, event.calculationVersion],
    [EXTENSIONS.isReplay, event.isReplay === true ? true : undefined],
    [EXTENSIONS.replaySequence, event.isReplay === true ? event.replaySequence : undefined],
    [
      EXTENSIONS.replayOfStatement,
      event.isReplay === true && nonEmpty(event.replayOfEventId)
        ? deterministicStatementId("LearningEvent", event.replayOfEventId)
        : undefined,
    ],
  ]);

  return {
    id: deterministicStatementId("LearningEvent", event.id),
    actor: makeActor(actorIdentifier, options),
    verb: { id: verb.id, display: { "en-US": verb.display } },
    object: {
      objectType: "Activity",
      id: activityId(kind, objectIdentifier),
      definition: {
        type: `${XAPI_BASE}/activity-types/${encodeURIComponent(kind)}`,
        name: { "en-US": kind.replace(/-/g, " ") },
      },
    },
    ...(learningResult(event) ? { result: learningResult(event) } : {}),
    context: { platform: "LiberiaLearn", extensions },
    timestamp: toTimestamp(event.originalOccurredAt ?? event.occurredAt),
    version: XAPI_STATEMENT_VERSION,
  };
}

export function mapStudentPerformanceEventToXapi(
  event: StudentPerformanceEventXapiSource,
  options: XapiMappingOptions
): XapiStatement {
  if (!nonEmpty(event.studentId)) throw new Error("StudentPerformanceEvent has no student identifier");
  if (!Number.isFinite(event.score) || event.score < 0 || event.score > 1) {
    throw new Error("StudentPerformanceEvent score must be between 0 and 1");
  }
  const verb = mapVerb(event.eventType);
  const kind = event.lessonId ? "lesson" : "performance-event";
  const objectIdentifier = event.lessonId ?? event.id;
  const resultExtensions = compactExtensions([
    [EXTENSIONS.attempts, event.attempts],
    [EXTENSIONS.aiAssistUsed, event.aiAssistUsed],
  ]);
  const contextExtensions = compactExtensions([
    [EXTENSIONS.sourceModel, "StudentPerformanceEvent"],
    [EXTENSIONS.gradeLevel, event.gradeLevel],
  ]);

  return {
    id: deterministicStatementId("StudentPerformanceEvent", event.id),
    actor: makeActor(options.actorIdentifier ?? event.studentId, options),
    verb: { id: verb.id, display: { "en-US": verb.display } },
    object: {
      objectType: "Activity",
      id: activityId(kind, objectIdentifier),
      definition: {
        type: `${XAPI_BASE}/activity-types/${kind}`,
        name: { "en-US": kind.replace(/-/g, " ") },
      },
    },
    result: {
      score: { scaled: event.score },
      duration: secondsToIsoDuration(event.durationSeconds),
      ...(Object.keys(resultExtensions).length > 0 ? { extensions: resultExtensions } : {}),
    },
    context: { platform: "LiberiaLearn", extensions: contextExtensions },
    timestamp: toTimestamp(event.createdAt),
    version: XAPI_STATEMENT_VERSION,
  };
}

function inspectForNullOrEmptyObject(value: unknown, path: string, errors: string[]): void {
  if (value === null) {
    errors.push(`${path} must not be null`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectForNullOrEmptyObject(item, `${path}[${index}]`, errors));
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) errors.push(`${path} must not be an empty object`);
    entries.forEach(([key, child]) => inspectForNullOrEmptyObject(child, `${path}.${key}`, errors));
  }
}

export function validateXapiStatement(value: unknown): XapiValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["Statement must be an object"] };
  }
  const statement = value as Record<string, any>;
  inspectForNullOrEmptyObject(statement, "statement", errors);

  if (!UUID_PATTERN.test(statement.id ?? "")) errors.push("Statement id must be an RFC 4122 UUID");
  if (statement.version !== XAPI_STATEMENT_VERSION) {
    errors.push(`Statement version must be ${XAPI_STATEMENT_VERSION}`);
  }
  if (!ISO_TIMESTAMP_PATTERN.test(statement.timestamp ?? "") || Number.isNaN(Date.parse(statement.timestamp))) {
    errors.push("Statement timestamp must be ISO 8601");
  }
  if (statement.actor?.objectType !== "Agent") errors.push("Statement actor must be an Agent");
  if (!isIri(statement.actor?.account?.homePage)) errors.push("Actor account homePage must be an absolute IRI");
  if (typeof statement.actor?.account?.name !== "string" || !/^[0-9a-f]{64}$/.test(statement.actor.account.name)) {
    errors.push("Actor account name must be an opaque SHA-256 pseudonym");
  }
  if ("name" in (statement.actor ?? {}) || "mbox" in (statement.actor ?? {}) || "mbox_sha1sum" in (statement.actor ?? {})) {
    errors.push("Actor must not contain direct identity fields");
  }
  if (!isIri(statement.verb?.id)) errors.push("Verb id must be an absolute IRI");
  if (typeof statement.verb?.display?.["en-US"] !== "string" || !statement.verb.display["en-US"]) {
    errors.push("Verb display must include en-US text");
  }
  if (statement.object?.objectType !== "Activity") errors.push("Statement object must be an Activity");
  if (!isIri(statement.object?.id)) errors.push("Activity id must be an absolute IRI");
  if (!isIri(statement.object?.definition?.type)) errors.push("Activity type must be an absolute IRI");
  if (typeof statement.object?.definition?.name?.["en-US"] !== "string" || !statement.object.definition.name["en-US"]) {
    errors.push("Activity name must include en-US text");
  }
  if (statement.context?.platform !== "LiberiaLearn") errors.push("Context platform must be LiberiaLearn");

  if (statement.result?.score) {
    const scaled = statement.result.score.scaled;
    if (typeof scaled !== "number" || !Number.isFinite(scaled) || scaled < -1 || scaled > 1) {
      errors.push("Result scaled score must be between -1 and 1");
    }
  }
  if (statement.result?.duration && !ISO_DURATION_PATTERN.test(statement.result.duration)) {
    errors.push("Result duration must be ISO 8601");
  }

  const extensionContainers: Array<[Record<string, unknown> | undefined, Set<string>, string]> = [
    [statement.context?.extensions, ALLOWED_CONTEXT_EXTENSIONS, "Context"],
    [statement.result?.extensions, ALLOWED_RESULT_EXTENSIONS, "Result"],
  ];
  for (const [extensions, allowlist, label] of extensionContainers) {
    if (!extensions) continue;
    for (const key of Object.keys(extensions)) {
      if (!isIri(key)) errors.push(`Extension key must be an absolute IRI: ${key}`);
      if (!allowlist.has(key)) errors.push(`${label} extension is not allowlisted: ${key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
