import { enrichGeneratedLesson } from "@/lib/curriculum/generatedLessonEnricher";

/**
 * Hosted-shape LEGACY Grade 7 lesson for the browser harness. The body is produced by the repository's own
 * deterministic enricher (lib/curriculum/generatedLessonEnricher.ts) for Grade 7 MATH "Number Sense and Place
 * Value", which is the text shape the hosted Grade 7 Number Sense lesson presents: eleven authored sections,
 * mostly written as guidance for the teacher, no numbers, tables or pictures. Nothing here is written by the
 * harness; it is not curriculum content, a release or a native Lesson Experience (the delivery seam answers 404).
 */
export const GENERATED_CONTENT_ID = "fixture-g7-number-sense-generated";

export function generatedCurriculumResponse() {
  const { payload } = enrichGeneratedLesson({
    contentId: GENERATED_CONTENT_ID,
    grade: 7,
    subject: "MATH",
    payload: { title: "Number Sense and Place Value", unitTitle: "Number Sense and Place Value", objectives: ["Explain and apply number sense and place value."] },
  });
  return {
    metadata: { contentId: GENERATED_CONTENT_ID, grade: 7, subject: "MATHEMATICS", version: "1", moeAlignments: [] },
    payload: { title: payload.title, objectives: payload.objectives, body_standard: payload.body_standard, studentReady: true },
    audio: { status: "NOT_GENERATED" },
    offlineManifest: null,
  };
}

/**
 * A genuinely long hosted-shape Grade 7 lesson: the repository enricher's Grade 7 LITERACY output with its
 * 45-minute and 90-minute bodies placed one after the other (11 + 6 = 17 authored sections). Test shape only.
 */
export const LONG_GENERATED_CONTENT_ID = "fixture-g7-literacy-generated-long";

export function longGeneratedCurriculumResponse() {
  const { payload } = enrichGeneratedLesson({
    contentId: LONG_GENERATED_CONTENT_ID,
    grade: 7,
    subject: "LITERACY",
    payload: { title: "Main Idea and Key Details", unitTitle: "Main Idea and Key Details", objectives: ["Identify the main idea and supporting details of a text."] },
  });
  return {
    metadata: { contentId: LONG_GENERATED_CONTENT_ID, grade: 7, subject: "LITERACY", version: "1", moeAlignments: [] },
    payload: { title: payload.title, objectives: payload.objectives, body_standard: `${payload.body_standard}\n\n${payload.body_block}`, studentReady: true },
    audio: { status: "NOT_GENERATED" },
    offlineManifest: null,
  };
}

/**
 * Synthetic stress fixture (not curriculum): 22 numbered sections with long paragraphs, for the contents-height,
 * section-switching and scroll measurements. The text is placeholder prose about the fixture itself.
 */
export const STRESS_CONTENT_ID = "fixture-g7-stress-22-sections";
export const STRESS_SECTION_COUNT = 22;

export function stressCurriculumResponse() {
  const paragraph = (n: number, p: number) => `Fixture section ${n}, paragraph ${p}. This placeholder text exists only to measure layout: it is long enough to wrap across several lines at every width, so the test can see whether one section at a time keeps the page short, whether the contents rail scrolls on its own, and whether Previous and Next stay reachable without passing through the other sections.`;
  const body = Array.from({ length: STRESS_SECTION_COUNT }, (_, index) => {
    const n = index + 1;
    return `## Section ${n}: ${n === 17 ? "The section a learner opens directly" : `Fixture topic ${n}`}\n\n${[1, 2, 3, 4].map((p) => paragraph(n, p)).join("\n\n")}`;
  }).join("\n\n");
  return {
    metadata: { contentId: STRESS_CONTENT_ID, grade: 7, subject: "LITERACY", version: "1", moeAlignments: [] },
    payload: { title: "Layout stress fixture (22 sections)", objectives: ["Fixture objective."], body_standard: body, studentReady: true },
    audio: { status: "NOT_GENERATED" },
    offlineManifest: null,
  };
}
