import { V4_LESSONS, type V4Lesson } from "@/lib/curriculum/v4/candidates";

// Proposed objectives for these revisions only. Source references confer no approval.
export const DRAFT6_LESSONS: readonly V4Lesson[] = V4_LESSONS.map(lesson => ({
  ...lesson,
  objectives: lesson.objectives.map((objective, index) => ({ ...objective,
    statement: lesson.subject === "SCIENCE" && index === 2
      ? "Interpret a pure-water heating curve at fixed pressure, explain its melting plateau with latent heat, and describe reversible physical changes."
      : lesson.subject === "CIVICS" ? [
        "Locate Liberia's fifteen counties on the supplied geographic outline map and match each with its administrative capital.",
        "Distinguish county capitals from the national capital and well-known towns, using Montserrado and Nimba.",
        "Use the supplied geographic map to compare north-south position and coastal location, while distinguishing these from unverified road routes.",
      ][index] : objective.statement,
    moeReferences: objective.moeReferences.map(reference => ({ ...reference, relation: "CONTENT_REFERENCE" as const })),
  })),
}));
