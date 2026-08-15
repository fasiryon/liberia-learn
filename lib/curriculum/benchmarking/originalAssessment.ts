export const LIBERIALEARN_EXAM_PREPARATION_LABEL = "LiberiaLearn WAEC Preparation";
export const ORIGINAL_EXAM_STYLE_ORIGIN = "LIBERIALEARN_GENERATED_EXAM_STYLE" as const;

const PROHIBITED_LABELS = [/official waec course/i, /waec approved/i, /waec endorsed/i, /official waec question/i];

export function buildOriginalAssessmentContract(input: {
  examination: string;
  competencyCodes: string[];
  readinessLayer: "BASELINE_READINESS" | "LIBERIALEARN_MASTERY";
  promptKey: string;
  sourceEvidenceRefs: unknown[];
}) {
  if (input.competencyCodes.length === 0) throw new Error("ASSESSMENT_COMPETENCY_REQUIRED");
  if (input.sourceEvidenceRefs.length === 0) throw new Error("ASSESSMENT_EVIDENCE_REQUIRED");
  return {
    label: LIBERIALEARN_EXAM_PREPARATION_LABEL,
    examination: input.examination,
    competencyCodes: [...input.competencyCodes],
    readinessLayer: input.readinessLayer,
    contentOrigin: ORIGINAL_EXAM_STYLE_ORIGIN,
    promptKey: input.promptKey,
    sourceEvidenceRefs: input.sourceEvidenceRefs,
    prohibitedInputs: ["PAST_PAPER_TEXT", "SCRAPED_QUESTION_BANK", "SYSTEMATIC_PARAPHRASE_OF_PROTECTED_ITEM"],
    externalAuthorityStatus: "NOT_CLAIMED" as const,
  };
}

export function assertSafeExamPreparationLabel(label: string): void {
  if (PROHIBITED_LABELS.some((pattern) => pattern.test(label))) {
    throw new Error("EXTERNAL_AUTHORITY_LABEL_PROHIBITED");
  }
}
