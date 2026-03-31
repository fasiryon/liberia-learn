import type { TeacherConfusionItem } from "@/components/intelligence/ConfusionList";
import type { TeacherInterventionItem } from "@/components/intelligence/InterventionTable";

export type AdvisoryAction = {
  type: "assign_lesson" | "review_concept" | "teacher_attention";
  reason: string;
  confidence: number;
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildAdvisoryActions(input: {
  confusions: TeacherConfusionItem[];
  interventions: TeacherInterventionItem[];
}): AdvisoryAction[] {
  const actions: AdvisoryAction[] = [];
  const highSignals = input.confusions.filter((item) => item.severity === "high");
  const topConcept = input.confusions[0]?.conceptLabel;

  if (input.interventions.some((item) => item.recommendationType === "extra_practice")) {
    actions.push({
      type: "assign_lesson",
      reason: "Existing intervention signals indicate the student or class would benefit from targeted follow-up practice.",
      confidence: 0.82,
    });
  }

  if (topConcept) {
    actions.push({
      type: "review_concept",
      reason: `Recent confusion signals cluster around ${topConcept}, so a focused concept review is advisable.`,
      confidence: clampConfidence(0.6 + Math.min(input.confusions.length, 4) * 0.08),
    });
  }

  if (
    highSignals.length > 0 ||
    input.interventions.some((item) => item.recommendationType === "teacher_attention")
  ) {
    actions.push({
      type: "teacher_attention",
      reason: "High-severity confusion or a pending teacher-attention intervention is present and should be reviewed directly by the teacher.",
      confidence: highSignals.length > 1 ? 0.92 : 0.84,
    });
  }

  return actions.slice(0, 3);
}
