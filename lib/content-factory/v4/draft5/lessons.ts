import { V4_LESSONS, type V4Lesson } from "@/lib/curriculum/v4/candidates";

/** These are new lesson objectives, not a claim to complete the old map-location objectives. */
export const DRAFT5_LESSONS: readonly V4Lesson[] = V4_LESSONS.filter(l => ["g7-math-area-perimeter", "g7-civics-counties-capitals"].includes(l.key)).map(lesson => lesson.subject !== "CIVICS" ? lesson : {
  ...lesson,
  objectives: lesson.objectives.map((o, index) => ({ ...o,
    statement: ["Identify Liberia's fifteen county-capital pairs in a name register, without inferring geographic locations from entry order.", "Distinguish county capitals from well-known cities and the national capital using Nimba and Montserrado as examples.", "Explain which administrative claims a county-capital register supports and request geographic and road sources for route planning."][index],
    moeReferences: o.moeReferences.map(r => ({ ...r, relation: "CONTENT_REFERENCE" as const })),
  })),
});
