import {
  GRADE4_MATH_ONTOLOGY_RELEASE,
  deterministicReleaseIdentity,
} from "@/lib/learning-authority/governedGrade4Math";

export const MISCONCEPTION_SIGNAL_POLICY_VERSION = "misconception-signal-policy/1.0.0" as const;

export const GRADE4_MATH_MISCONCEPTION_POLICY = Object.freeze({
  id: "liberialearn-g4-math-misconception-signals",
  version: MISCONCEPTION_SIGNAL_POLICY_VERSION,
  authority: "LIBERIALEARN_GOVERNED_EDUCATIONAL_POLICY" as const,
  ontologyReleaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
  ontologyReleaseIdentity: deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE),
  definitions: Object.freeze([
    Object.freeze({
      id: "g4-fractions-numerator-denominator-reversal",
      categoryCode: "fraction_numerator_denominator_reversal",
      label: "May reverse the numerator and denominator when naming a fraction",
    }),
  ]),
  mappings: Object.freeze([
    Object.freeze({
      bindingId: "g4-frac-bind-equal-parts-v1",
      itemId: "g4-frac-diagnostic-equal-parts",
      itemVersion: "1.0.0",
      selectedAnswerIndex: 3,
      signalId: "g4-fractions-numerator-denominator-reversal",
    }),
  ]),
});

export function resolveGovernedMisconceptionSignal(input: {
  ontologyReleaseId: string;
  ontologyReleaseIdentity: string;
  bindingId: string;
  itemId: string;
  itemVersion: string;
  selectedAnswerIndex: number;
}): string | null {
  if (input.ontologyReleaseId !== GRADE4_MATH_MISCONCEPTION_POLICY.ontologyReleaseId ||
    input.ontologyReleaseIdentity !== GRADE4_MATH_MISCONCEPTION_POLICY.ontologyReleaseIdentity) return null;
  return GRADE4_MATH_MISCONCEPTION_POLICY.mappings.find((mapping) =>
    mapping.bindingId === input.bindingId && mapping.itemId === input.itemId &&
    mapping.itemVersion === input.itemVersion && mapping.selectedAnswerIndex === input.selectedAnswerIndex
  )?.signalId ?? null;
}
