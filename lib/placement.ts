export type PlacementBand = "foundational" | "developing" | "proficient" | "advanced";

export function getPlacementBand(rawScore: number, totalQuestions: number): PlacementBand {
  const scorePercent = totalQuestions > 0 ? (rawScore / totalQuestions) * 100 : 0;

  if (scorePercent <= 40) return "foundational";
  if (scorePercent <= 70) return "developing";
  if (scorePercent <= 85) return "proficient";
  return "advanced";
}

export const placementBandLabels: Record<PlacementBand, string> = {
  foundational: "Foundational",
  developing: "Developing",
  proficient: "Proficient",
  advanced: "Advanced",
};

export const placementBandStyles: Record<PlacementBand, string> = {
  foundational: "border-amber-500/30 bg-amber-500/15 text-amber-200",
  developing: "border-blue-500/30 bg-blue-500/15 text-blue-200",
  proficient: "border-green-500/30 bg-green-500/15 text-green-200",
  advanced: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
};

export type PlacementReviewStatus = "pending" | "confirmed" | "overridden";

export function getPlacementReviewStatus(teacherDecision?: string | null): PlacementReviewStatus {
  if (teacherDecision === "confirmed") return "confirmed";
  if (teacherDecision === "overridden") return "overridden";
  return "pending";
}

export const placementReviewStatusStyles: Record<PlacementReviewStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/15 text-amber-200",
  confirmed: "border-green-500/30 bg-green-500/15 text-green-200",
  overridden: "border-blue-500/30 bg-blue-500/15 text-blue-200",
};

export const placementReviewStatusLabels: Record<PlacementReviewStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  overridden: "Overridden",
};

export function getPlacementOutcomeText(input: {
  estimatedGrade: number;
  teacherDecision?: string | null;
  teacherGrade?: number | null;
}) {
  const status = getPlacementReviewStatus(input.teacherDecision);
  if (status === "confirmed") {
    return `AI recommended Grade ${input.estimatedGrade}, teacher confirmed Grade ${input.estimatedGrade}`;
  }
  if (status === "overridden") {
    return `AI recommended Grade ${input.estimatedGrade}, teacher adjusted to Grade ${input.teacherGrade ?? input.estimatedGrade}`;
  }
  return `AI recommended Grade ${input.estimatedGrade}, teacher review pending`;
}
