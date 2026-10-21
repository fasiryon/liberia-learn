/**
 * Modernization track and priority for one audited legacy lesson.
 *
 *   A  TARGETED_REPAIR          sound foundation; add/correct items, misconceptions, keys, accessibility, retention, transfer.
 *   B  INSTRUCTIONAL_REDESIGN   useful content, weak progression: rebuild scenes, worked examples, practice, tasks.
 *   C  FULL_REPLACEMENT         template shell, stub, factually unreliable or confirmed mis-mapped: new candidate, legacy preserved.
 *   D  GOVERNANCE_HOLD          source, objective authority, ownership or lifecycle missing; nothing is invented to fill it.
 *
 * Tracks assigned here are PROVISIONAL (mechanical basis). A curriculum reviewer confirms or changes the
 * track; confirmation is a ledger event by a human, never by this module.
 *
 * Priority orders work by educational risk, learner exposure, curriculum importance, prerequisite
 * dependants and assignment usage, divided by effort. It never sorts alphabetically or by lesson count.
 */
import type { LibraryExtractRecord } from "./extract";
import type { AuditFinding, LessonAudit } from "./legacyAudit";

export const MODERNIZATION_TRACKS = ["A_TARGETED_REPAIR", "B_INSTRUCTIONAL_REDESIGN", "C_FULL_REPLACEMENT", "D_GOVERNANCE_HOLD"] as const;
export type ModernizationTrack = (typeof MODERNIZATION_TRACKS)[number];

export const CLASSIFIER_VERSION = "liberialearn-modernization-classifier/1.0.0" as const;

/** Findings that mean the instructional progression itself must be rebuilt (Track B). */
const REDESIGN_CODES = new Set([
  "NO_WORKED_EXAMPLE", "NO_GUIDED_PRACTICE", "NO_INDEPENDENT_PRACTICE", "THIN_CONCEPT_EXPLANATION", "NO_END_OF_LESSON_ASSESSMENT",
  "TEXT_LOAD_EXCEEDS_EMERGENT_READER_BUDGET", "NO_SCENE_STRUCTURE", "SERIALIZATION_ARTIFACT", "TEMPLATE_SHELL",
]);
/** Findings that call for replacement once a reviewer confirms them (they are indicators, not verdicts). */
const REPLACEMENT_ON_CONFIRMATION = new Set(["POSSIBLE_SUBJECT_MISLABEL"]);

const EFFORT: Readonly<Record<ModernizationTrack, number>> = Object.freeze({ A_TARGETED_REPAIR: 1, B_INSTRUCTIONAL_REDESIGN: 2, C_FULL_REPLACEMENT: 3, D_GOVERNANCE_HOLD: 0 });

export type LessonClassification = Readonly<{
  classifierVersion: typeof CLASSIFIER_VERSION;
  track: ModernizationTrack;
  /** For a held lesson, the track it would take once the hold is resolved. */
  trackAfterHold: Exclude<ModernizationTrack, "D_GOVERNANCE_HOLD"> | null;
  basis: "MECHANICAL_PROVISIONAL";
  reasons: readonly string[];
  holdReasons: readonly string[];
  /** Reviewer confirmation that would move this lesson to Track C. */
  replacementIfConfirmed: readonly string[];
  priority: Readonly<{
    score: number;
    risk: number;
    exposure: number;
    importance: number;
    dependency: number;
    effort: number;
    foundational: boolean;
  }>;
}>;

const log2p = (n: number) => Math.log2(1 + Math.max(0, n));
const codes = (findings: readonly AuditFinding[], predicate: (finding: AuditFinding) => boolean) => Array.from(new Set(findings.filter(predicate).map((finding) => finding.code)));

/** Foundational subjects: literacy and numeracy carry every later subject, most of all in the early grades. */
export function curriculumImportance(subject: string, grade: number): { weight: number; foundational: boolean } {
  const s = subject.toUpperCase();
  if (s === "MATH" || s === "ENGLISH" || s === "LITERACY") return { weight: grade <= 3 ? 3 : grade <= 6 ? 2.6 : grade <= 9 ? 2.2 : 1.8, foundational: true };
  if (s === "SCIENCE") return { weight: grade <= 9 ? 1.6 : 1.5, foundational: false };
  if (s === "SOCIAL_STUDIES" || s === "CIVICS" || s === "HISTORY") return { weight: 1.4, foundational: false };
  return { weight: 1, foundational: false };
}

export function classifyLesson(record: LibraryExtractRecord, audit: LessonAudit): LessonClassification {
  const findings = audit.findings;
  const holdReasons = codes(findings, (finding) => finding.kind === "GOVERNANCE" && finding.severity === "BLOCKING");
  const blockingQuality = codes(findings, (finding) => finding.kind !== "GOVERNANCE" && finding.severity === "BLOCKING");
  const redesign = codes(findings, (finding) => REDESIGN_CODES.has(finding.code) && finding.severity !== "INFO" && finding.severity !== "MINOR");
  const replacementIfConfirmed = codes(findings, (finding) => REPLACEMENT_ON_CONFIRMATION.has(finding.code));
  const repairs = codes(findings, (finding) => finding.severity === "MAJOR" || finding.severity === "MINOR");

  const qualityTrack: Exclude<ModernizationTrack, "D_GOVERNANCE_HOLD"> = blockingQuality.length ? "C_FULL_REPLACEMENT" : redesign.length ? "B_INSTRUCTIONAL_REDESIGN" : "A_TARGETED_REPAIR";
  const track: ModernizationTrack = holdReasons.length ? "D_GOVERNANCE_HOLD" : qualityTrack;
  const reasons = qualityTrack === "C_FULL_REPLACEMENT" ? blockingQuality : qualityTrack === "B_INSTRUCTIONAL_REDESIGN" ? redesign : repairs;

  // Risk: how much harm the current revision can do to learners who meet it.
  const severityWeight = (finding: AuditFinding) => (finding.severity === "BLOCKING" ? 3 : finding.severity === "MAJOR" ? 1 : finding.severity === "MINOR" ? 0.25 : 0);
  const accuracyRisk = findings.filter((finding) => ["ARITHMETIC_ERROR", "POSSIBLE_SUBJECT_MISLABEL", "ANSWER_KEY_IN_LEARNER_TEXT", "SERIALIZATION_ARTIFACT"].includes(finding.code) || finding.code.startsWith("UNSOURCED_CLAIM")).length;
  const risk = Math.round((findings.filter((finding) => finding.kind !== "GOVERNANCE").reduce((sum, finding) => sum + severityWeight(finding), 0) / 4 + accuracyRisk * 2) * 100) / 100;

  // Exposure: present and past learner contact (counts only).
  const d = record.dependencies;
  const exposure = Math.round((2 * log2p(d.studentProgress) + log2p(d.scheduledWork) + log2p(d.learningEvents) + 1.5 * d.scheduledWorkSchools + 2 * (d.assignments + d.homework) + 0.5 * log2p(d.lessonPlans + d.teacherLessonAssignments) + log2p(d.tutorConversations + d.helpFlags)) * 100) / 100;
  const { weight: importance, foundational } = curriculumImportance(record.row.subject, record.row.grade);
  const dependency = Math.round(log2p(d.dependentLessons) * 100) / 100;
  const effort = EFFORT[qualityTrack];
  const score = track === "D_GOVERNANCE_HOLD" ? 0 : Math.round(((risk * importance) + exposure + 2 * dependency) / Math.sqrt(effort) * 100) / 100;

  return Object.freeze({
    classifierVersion: CLASSIFIER_VERSION,
    track,
    trackAfterHold: track === "D_GOVERNANCE_HOLD" ? qualityTrack : null,
    basis: "MECHANICAL_PROVISIONAL",
    reasons: Object.freeze(reasons),
    holdReasons: Object.freeze(holdReasons),
    replacementIfConfirmed: Object.freeze(replacementIfConfirmed),
    priority: Object.freeze({ score, risk, exposure, importance, dependency, effort, foundational }),
  });
}

export type WavePlanEntry = Readonly<{ contentId: string; wave: number; rank: number; score: number; track: ModernizationTrack; cell: string }>;

/**
 * Orders schedulable lessons into waves by priority while keeping grade and subject coverage: each wave
 * first takes the highest-priority lesson of every grade/subject cell not yet represented, then fills by
 * score. Held lessons (Track D) are not scheduled until their hold is resolved.
 */
export function planWaves(
  items: readonly Readonly<{ contentId: string; grade: number; subject: string; classification: LessonClassification }>[],
  waveSize: number,
): readonly WavePlanEntry[] {
  const pending = items
    .filter((item) => item.classification.track !== "D_GOVERNANCE_HOLD")
    .slice()
    .sort((a, b) => b.classification.priority.score - a.classification.priority.score || a.contentId.localeCompare(b.contentId));
  const out: WavePlanEntry[] = [];
  const covered = new Set<string>();
  let wave = 1;
  while (pending.length) {
    const picked: typeof pending = [];
    for (let i = 0; i < pending.length && picked.length < Math.ceil(waveSize / 3); i += 1) {
      const cell = `${pending[i].grade}|${pending[i].subject}`;
      if (!covered.has(cell) && !picked.some((item) => `${item.grade}|${item.subject}` === cell)) picked.push(pending[i]);
    }
    for (const item of pending) if (picked.length < waveSize && !picked.includes(item)) picked.push(item);
    picked.sort((a, b) => b.classification.priority.score - a.classification.priority.score || a.contentId.localeCompare(b.contentId));
    for (const item of picked) {
      covered.add(`${item.grade}|${item.subject}`);
      out.push(Object.freeze({ contentId: item.contentId, wave, rank: out.length + 1, score: item.classification.priority.score, track: item.classification.track, cell: `G${item.grade} ${item.subject}` }));
      pending.splice(pending.indexOf(item), 1);
    }
    wave += 1;
  }
  return Object.freeze(out);
}
