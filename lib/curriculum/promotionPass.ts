import { countLessonWords } from "@/lib/curriculum/generatedLessonEnricher";

export type PromotionRecord = {
  contentId: string;
  grade: number;
  subject: string;
  status: string;
  payload: Record<string, any>;
};

export type PromotionDecision =
  | {
      action: "promote";
      gate: null;
      reason: string;
      words: number;
      normalizedPayload: Record<string, any>;
    }
  | {
      action: "skip";
      gate: number | null;
      reason: string;
      words: number;
    };

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeProgressionFields(payload: Record<string, any>) {
  const conceptTag =
    typeof payload.conceptTag === "string" && payload.conceptTag.trim().length > 0
      ? payload.conceptTag.trim()
      : typeof payload.primaryConcept === "string" && payload.primaryConcept.trim().length > 0
      ? payload.primaryConcept.trim()
      : null;

  const prerequisiteConcepts =
    asStringArray(payload.prerequisiteConcepts).length > 0
      ? asStringArray(payload.prerequisiteConcepts)
      : asStringArray(payload.prerequisites);

  return {
    conceptTag,
    prerequisiteConcepts,
  };
}

function hasExplanationSection(payload: Record<string, any>) {
  if (typeof payload.explanation === "string" && payload.explanation.trim().length > 0) return true;
  const body = typeof payload.body_standard === "string" ? payload.body_standard : typeof payload.body === "string" ? payload.body : "";
  return /##\s+(Teacher Explanation|Introduction|Opening)/i.test(body);
}

function workedExampleCount(payload: Record<string, any>) {
  const workedExamples = asStringArray(payload.workedExamples);
  if (workedExamples.length > 0) return workedExamples.length;
  const body = typeof payload.body_standard === "string" ? payload.body_standard : typeof payload.body === "string" ? payload.body : "";
  const matches = body.match(/Worked Example/gi) ?? [];
  return matches.length;
}

function practiceQuestionCount(payload: Record<string, any>) {
  const guided = asStringArray(payload.guidedPractice);
  const independent = asStringArray(payload.independentPractice);
  const activities = asStringArray(payload.activities);
  const body = typeof payload.body_standard === "string" ? payload.body_standard : typeof payload.body === "string" ? payload.body : "";
  const hasGuidedSection = /##\s+Guided Practice/i.test(body);
  const hasIndependentSection = /##\s+Independent Practice/i.test(body);

  return Math.max(
    guided.length + independent.length,
    activities.length,
    hasGuidedSection && hasIndependentSection ? 3 : 0
  );
}

function hasAssessment(payload: Record<string, any>) {
  if (typeof payload.assessment === "string" && payload.assessment.trim().length > 0) return true;
  const body = typeof payload.body_standard === "string" ? payload.body_standard : typeof payload.body === "string" ? payload.body : "";
  return /##\s+(Assessment|Assessment Questions|Closing|Exit Ticket)/i.test(body);
}

function buildApprovedPayload(payload: Record<string, any>, approvedAtIso: string, approvedBy: string) {
  const normalized = normalizeProgressionFields(payload);
  const metadata =
    payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? { ...payload.metadata }
      : {};

  return {
    ...payload,
    conceptTag: normalized.conceptTag,
    prerequisiteConcepts: normalized.prerequisiteConcepts,
    approvedAt: approvedAtIso,
    approvedBy,
    metadata: {
      ...metadata,
      approvedAt: approvedAtIso,
      approvedBy,
      promotionStage: "promotion-pass-2b",
    },
  };
}

export function evaluatePromotionCandidate(record: PromotionRecord, approvedAtIso = new Date().toISOString(), approvedBy = "system:promotion-pass-2b"): PromotionDecision {
  const payload = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload) ? record.payload : {};
  const words = countLessonWords(payload);

  if (record.status === "APPROVED") {
    return {
      action: "skip",
      gate: null,
      reason: "already approved",
      words,
    };
  }

  if (record.status !== "generated") {
    return {
      action: "skip",
      gate: null,
      reason: `unsupported status ${record.status}`,
      words,
    };
  }

  if (payload.generationStage !== "generated_enriched") {
    return {
      action: "skip",
      gate: null,
      reason: "lesson is not enriched",
      words,
    };
  }

  if (words < 1200) {
    return {
      action: "skip",
      gate: 1,
      reason: `word count ${words} below 1200`,
      words,
    };
  }

  if (!hasExplanationSection(payload)) {
    return {
      action: "skip",
      gate: 2,
      reason: "missing explanation or introduction",
      words,
    };
  }

  if (workedExampleCount(payload) < 1) {
    return {
      action: "skip",
      gate: 2,
      reason: "missing worked example",
      words,
    };
  }

  if (practiceQuestionCount(payload) < 3) {
    return {
      action: "skip",
      gate: 2,
      reason: "practice questions below 3",
      words,
    };
  }

  if (!hasAssessment(payload)) {
    return {
      action: "skip",
      gate: 2,
      reason: "missing assessment or exit ticket",
      words,
    };
  }

  const normalized = normalizeProgressionFields(payload);
  if (!normalized.conceptTag) {
    return {
      action: "skip",
      gate: 3,
      reason: "missing conceptTag",
      words,
    };
  }

  if (normalized.prerequisiteConcepts.length === 0) {
    return {
      action: "skip",
      gate: 3,
      reason: "missing prerequisiteConcepts",
      words,
    };
  }

  if (payload.grade !== record.grade) {
    return {
      action: "skip",
      gate: 4,
      reason: `payload grade ${String(payload.grade)} does not match record grade ${record.grade}`,
      words,
    };
  }

  if (typeof payload.subject !== "string" || payload.subject.trim().toUpperCase() !== record.subject.trim().toUpperCase()) {
    return {
      action: "skip",
      gate: 5,
      reason: `payload subject ${String(payload.subject)} does not match record subject ${record.subject}`,
      words,
    };
  }

  return {
    action: "promote",
    gate: null,
    reason: "passed all gates",
    words,
    normalizedPayload: buildApprovedPayload(payload, approvedAtIso, approvedBy),
  };
}
