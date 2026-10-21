/**
 * Builds the Library Modernization V1 baseline from a verified read-only extract: inventory, audits,
 * classifications, wave plan, ledger baseline events and the human-readable reports.
 *
 * Deterministic: the same extract, cleanup plan, candidate set and existing ledger produce byte-identical
 * outputs, and re-running appends no ledger events unless the live catalog or an audit changed.
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { LibraryExtractManifest, LibraryExtractRecord } from "./extract";
import { auditLegacyLesson, buildLibraryAuditContext, AUDIT_AREAS, LIBRARY_AUDIT_VERSION, type AuditFinding, type LessonAudit } from "./legacyAudit";
import { classifyLesson, planWaves, CLASSIFIER_VERSION, type LessonClassification, type WavePlanEntry } from "./classify";
import { buildInventoryRecord, INVENTORY_VERSION, type InventoryRecord } from "./inventory";
import { appendEvents, answerLedgerQuestions, type Ledger, type LedgerActor, type NewLedgerEvent } from "./ledger";

export const MODERNIZATION_DIR = "curriculum/modernization/v1";
export const LEDGER_FILE = `${MODERNIZATION_DIR}/ledger/events.jsonl`;
export const WAVE_SIZE = 40;

export const INVENTORY_TOOL: LedgerActor = Object.freeze({ kind: "AUTOMATED", id: "liberialearn.library-modernization-baseline/1.0.0", role: "INVENTORY_TOOL" });

export type ExistingCandidate = Readonly<{
  contentId: string;
  candidateId: string;
  candidateVersion: string;
  candidateHash: string;
  manifestHash: string;
  legacyRevisionId: string;
  authors: readonly LedgerActor[];
  ref: string;
}>;

export type CleanupPlanIndex = ReadonlyMap<string, readonly string[]>;

export function loadCleanupPlanIndex(file = "artifacts/curriculum-cleanup-v1/cleanup-plan.json"): { index: CleanupPlanIndex; capturedAt: string | null } {
  if (!fs.existsSync(file)) return { index: new Map(), capturedAt: null };
  const plan = JSON.parse(fs.readFileSync(file, "utf8")) as { snapshotCapturedAt?: string; actions?: { kind: string; contentId?: string }[] };
  const index = new Map<string, string[]>();
  for (const action of plan.actions ?? []) {
    if (!action.contentId) continue;
    index.set(action.contentId, Array.from(new Set([...(index.get(action.contentId) ?? []), action.kind])));
  }
  return { index, capturedAt: plan.snapshotCapturedAt ?? null };
}

export type BaselineBuild = Readonly<{
  audits: readonly LessonAudit[];
  classifications: ReadonlyMap<string, LessonClassification>;
  inventory: readonly InventoryRecord[];
  waves: readonly WavePlanEntry[];
  ledger: Ledger;
  appended: number;
}>;

export function buildBaseline(input: {
  manifest: LibraryExtractManifest;
  records: readonly LibraryExtractRecord[];
  cleanup: CleanupPlanIndex;
  candidates: readonly ExistingCandidate[];
  ledger: Ledger;
}): BaselineBuild {
  const context = buildLibraryAuditContext(input.records);
  const candidates = new Map(input.candidates.map((candidate) => [candidate.contentId, candidate]));
  const audits: LessonAudit[] = [];
  const classifications = new Map<string, LessonClassification>();
  const inventory: InventoryRecord[] = [];
  for (const record of input.records) {
    const audit = auditLegacyLesson(record, context);
    const classification = classifyLesson(record, audit);
    audits.push(audit);
    classifications.set(record.contentId, classification);
    const candidate = candidates.get(record.contentId);
    inventory.push(buildInventoryRecord({ record, audit, classification, cleanupActions: input.cleanup.get(record.contentId) ?? [], candidate: candidate ? `${candidate.candidateId} (${candidate.ref})` : null }));
  }
  const waves = planWaves(input.records.map((record) => ({ contentId: record.contentId, grade: record.row.grade, subject: record.row.subject, classification: classifications.get(record.contentId)! })), WAVE_SIZE);

  // Ledger: append only what changed since the last baseline.
  const at = new Date(input.manifest.capturedAt).toISOString();
  const additions: NewLedgerEvent[] = [];
  const byId = new Map(input.records.map((record) => [record.contentId, record]));
  for (const audit of audits) {
    const record = byId.get(audit.contentId)!;
    const state = input.ledger.lessons.get(audit.contentId);
    const classification = classifications.get(audit.contentId)!;
    const push = (body: NewLedgerEvent["body"]) => additions.push({ at, contentId: audit.contentId, actor: INVENTORY_TOOL, body });
    if (!state?.live || state.live.revisionId !== record.revision!.id || state.live.contentHash !== record.revision!.contentHash || state.live.status !== record.row.status) {
      push({ type: "LIVE_OBSERVED", revisionId: record.revision!.id, contentHash: record.revision!.contentHash, status: record.row.status, lifecycleState: record.provenance?.lifecycleState ?? null, extractSha256: input.manifest.extractSha256 });
    }
    if (!state?.audit || state.audit.stale || state.audit.auditDigest !== audit.auditDigest) {
      const findings = { BLOCKING: 0, MAJOR: 0, MINOR: 0, INFO: 0 };
      for (const finding of audit.findings) findings[finding.severity] += 1;
      push({ type: "AUDIT_RECORDED", revisionId: audit.revisionId, contentHash: audit.contentHash, auditVersion: LIBRARY_AUDIT_VERSION, auditDigest: audit.auditDigest, mechanicalOutcome: audit.mechanicalOutcome, reviewOutcome: audit.reviewOutcome, findings });
    }
    if (state?.track.proposed !== classification.track || state?.track.trackAfterHold !== classification.trackAfterHold || !state?.audit || state.audit.auditDigest !== audit.auditDigest) {
      push({ type: "TRACK_PROPOSED", track: classification.track, trackAfterHold: classification.trackAfterHold, auditDigest: audit.auditDigest, reasons: classification.track === "D_GOVERNANCE_HOLD" ? classification.holdReasons : classification.reasons });
    }
    if (classification.holdReasons.length && (!state?.hold.active || classification.holdReasons.some((reason) => !state.hold.reasons.includes(reason)))) {
      push({ type: "HOLD_PLACED", reasons: classification.holdReasons });
    }
  }
  // Candidates that already exist in the repository (e.g. Grade 7 v0.3.0 on PR #191).
  for (const candidate of input.candidates) {
    const record = byId.get(candidate.contentId);
    if (!record?.revision) continue;
    const pending = appendEvents(input.ledger, additions);
    const state = pending.lessons.get(candidate.contentId);
    if (state?.candidate?.candidateHash === candidate.candidateHash) continue;
    const author = candidate.authors[candidate.authors.length - 1];
    additions.push({ at, contentId: candidate.contentId, actor: author, body: {
      type: "CANDIDATE_REGISTERED", candidateId: candidate.candidateId, candidateVersion: candidate.candidateVersion, candidateHash: candidate.candidateHash,
      manifestHash: candidate.manifestHash, legacyRevisionId: record.revision.id, legacyContentHash: record.revision.contentHash, authors: candidate.authors,
    } });
    additions.push({ at, contentId: candidate.contentId, actor: author, body: { type: "REVIEW_REQUESTED", candidateHash: candidate.candidateHash, scopes: ["ACADEMIC", "ASSESSMENT", "ACCESSIBILITY", "LOCALIZATION"] } });
  }
  const ledger = appendEvents(input.ledger, additions);
  return { audits, classifications, inventory, waves, ledger, appended: additions.length };
}

// ─── Serialization ──────────────────────────────────────────────────────────

const json = (value: unknown) => `${JSON.stringify(value, null, 1)}\n`;
/** JSON whose top-level arrays hold one record per line, so a diff shows exactly which lessons changed. */
const jsonRecords = (value: Record<string, unknown>) =>
  `{\n${Object.entries(value).map(([key, entry]) => `${JSON.stringify(key)}: ${Array.isArray(entry) ? `[\n${entry.map((item) => JSON.stringify(item)).join(",\n")}\n]` : JSON.stringify(entry)}`).join(",\n")}\n}\n`;
export const digest = (value: unknown) => createHash("sha256").update(canonicalizeJson(value)).digest("hex");

/** Per (code, severity): the issue and correction text, stored once instead of per finding. */
export function findingCatalogue(audits: readonly LessonAudit[]): Record<string, { area: string; kind: string; issue: string; proposedCorrection: string; lessons: number }> {
  const out: Record<string, { area: string; kind: string; issue: string; proposedCorrection: string; lessons: number }> = {};
  for (const audit of audits) {
    const seen = new Set<string>();
    for (const finding of audit.findings) {
      const key = `${finding.code}|${finding.severity}`;
      const entry = out[key];
      if (entry && (entry.issue !== finding.issue || entry.proposedCorrection !== finding.proposedCorrection)) throw new Error(`FINDING_TEXT_NOT_CONSTANT:${key}`);
      if (!entry) out[key] = { area: finding.area, kind: finding.kind, issue: finding.issue, proposedCorrection: finding.proposedCorrection, lessons: 0 };
      if (!seen.has(key)) { out[key].lessons += 1; seen.add(key); }
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

const compactFinding = (finding: AuditFinding) => [finding.id.split("#")[1], finding.code, finding.severity, finding.kind, finding.area, finding.where, finding.evidence];

export function compactAudit(audit: LessonAudit) {
  return {
    contentId: audit.contentId, revisionId: audit.revisionId, contentHash: audit.contentHash, grade: audit.grade, subject: audit.subject,
    mechanicalOutcome: audit.mechanicalOutcome, judgmentStatus: audit.judgmentStatus, reviewOutcome: audit.reviewOutcome,
    moeCell: audit.moeCell, moeObjectiveLeads: audit.moeObjectiveLeads, examinations: audit.examinations,
    areas: Object.fromEntries(audit.areas.map((area) => [area.area, area.status])),
    findings: audit.findings.map(compactFinding),
    metrics: audit.metrics, isLearningEvidence: audit.isLearningEvidence, auditDigest: audit.auditDigest,
  };
}

export type RepositorySources = Readonly<Record<string, Readonly<{ count: number; kind: string; note: string }>>>;

export function repositorySources(root = process.cwd()): RepositorySources {
  const files = (dir: string, pattern = /\.json$/) => {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) return 0;
    const walk = (d: string): number => fs.readdirSync(d, { withFileTypes: true }).reduce((n, entry) => n + (entry.isDirectory() ? walk(path.join(d, entry.name)) : pattern.test(entry.name) ? 1 : 0), 0);
    return walk(full);
  };
  return Object.freeze({
    "FactoryArtifacts/Subjects": { count: files("FactoryArtifacts/Subjects"), kind: "DRAFT_SUBJECT_SHELLS", note: "Day-1 grade x subject shells (status draft); not lessons, not in the production catalog." },
    "curriculum/v2/g4-math/candidates": { count: files("curriculum/v2/g4-math/candidates"), kind: "UNPUBLISHED_CANDIDATES", note: "Grade 4 Math Curriculum V2 proof candidates; production has 0 Grade 4 Math lessons." },
    "lib/curriculum/authority/grade4Math": { count: files("lib/curriculum/authority/grade4Math", /^unit\d+\.ts$/), kind: "AUTHORED_UNIT_SOURCES", note: "Grade 4 fractions authority units; not in the production catalog." },
    "curriculum/v2/g7/candidates": { count: files("curriculum/v2/g7/candidates"), kind: "UNPUBLISHED_CANDIDATES", note: "Grade 7 v0.3.0 native candidates (PR #191); bound to live legacy lessons in the ledger." },
    "lib/learner-experience/demo + fixtures": { count: files("lib/learner-experience/demo", /\.ts$/) + files("lib/learner-experience/fixtures", /\.ts$/), kind: "SYNTHETIC_DEMOS", note: "Design-preview and fixture lessons; never inventoried as library content." },
  });
}

export function writeBaseline(build: BaselineBuild, manifest: LibraryExtractManifest, options: { root?: string; cleanupCapturedAt: string | null }): string[] {
  const root = options.root ?? process.cwd();
  const out = (rel: string, content: string) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return rel;
  };
  const written: string[] = [];
  const sources = repositorySources(root);
  const meta = {
    inventoryVersion: INVENTORY_VERSION, auditVersion: LIBRARY_AUDIT_VERSION, classifierVersion: CLASSIFIER_VERSION,
    extract: { capturedAt: manifest.capturedAt, lessons: manifest.lessons, extractSha256: manifest.extractSha256, target: manifest.target, transactionReadOnly: manifest.transactionReadOnly, revisionHashMismatches: manifest.revisionHashMismatches, liveRowsDifferingFromCurrentRevision: manifest.liveRowsDifferingFromCurrentRevision },
    cleanupPlanV1CapturedAt: options.cleanupCapturedAt,
    notice: "Production catalog only. No learner, user, author or school identifiers; dependencies are counts. Mechanical audit and provisional tracks are design evidence, not learning evidence.",
  };
  written.push(out(`${MODERNIZATION_DIR}/inventory.json`, jsonRecords({ ...meta, repositorySources: sources, lessons: build.inventory })));
  const byGrade = new Map<number, LessonAudit[]>();
  for (const audit of build.audits) byGrade.set(audit.grade, [...(byGrade.get(audit.grade) ?? []), audit]);
  for (const [grade, audits] of Array.from(byGrade.entries()).sort((a, b) => a[0] - b[0])) {
    written.push(out(`${MODERNIZATION_DIR}/audit/grade-${String(grade).padStart(2, "0")}.json`, jsonRecords({ auditVersion: LIBRARY_AUDIT_VERSION, findingColumns: ["id", "code", "severity", "kind", "area", "where", "evidence"], audits: audits.map(compactAudit) })));
  }
  written.push(out(`${MODERNIZATION_DIR}/audit/finding-catalogue.json`, json(findingCatalogue(build.audits))));
  written.push(out(`${MODERNIZATION_DIR}/waves.json`, jsonRecords({ waveSize: WAVE_SIZE, planDigest: digest(build.waves), note: "A proposed order of work. Scheduling is a governance decision recorded in the ledger (WAVE_SCHEDULED).", waves: build.waves })));
  const tracker = build.inventory.map((record) => {
    const state = build.ledger.lessons.get(record.contentId);
    const wave = build.waves.find((entry) => entry.contentId === record.contentId);
    return {
      contentId: record.contentId, grade: record.grade, subject: record.subject, title: record.title, status: record.publication.status,
      liveRevisionId: record.revision.id, liveContentHash: record.revision.contentHash, reviewOutcome: record.audit.reviewOutcome, track: record.classification.track,
      trackAfterHold: record.classification.trackAfterHold, priority: record.classification.priority, proposedWave: wave?.wave ?? null, ledgerStage: state?.stage ?? "NOT_OBSERVED",
      candidate: state?.candidate ? { id: state.candidate.candidateId, hash: state.candidate.candidateHash } : null, outcome: state?.outcome.status ?? "NO_EVIDENCE",
    };
  });
  written.push(out(`${MODERNIZATION_DIR}/tracker.json`, jsonRecords({ generatedFrom: meta.extract, ledgerHead: build.ledger.head, answers: answerLedgerQuestions(build.ledger), lessons: tracker })));
  written.push(out(`${MODERNIZATION_DIR}/ledger/state.json`, json({ head: build.ledger.head, events: build.ledger.events.length, answers: answerLedgerQuestions(build.ledger) })));
  return written;
}

export const AUDIT_AREA_COUNT = AUDIT_AREAS.length;
