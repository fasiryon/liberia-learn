import {
  NR13_GRADES,
  NR13_SUBJECTS,
  buildNr13GenerationPlan,
  validateNr13Lesson,
  type Nr13Subject,
} from "../lib/curriculum/nr13Grades58";

function flag(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const grade = Number(flag("grade", "5"));
const subject = flag("subject", "ENGLISH").toUpperCase() as Nr13Subject;
const lessonNumber = Number(flag("lesson", "1"));

if (!NR13_GRADES.includes(grade as (typeof NR13_GRADES)[number]) || !NR13_SUBJECTS.includes(subject) || !Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 15) {
  throw new Error("Usage: npm run preview:nr13 -- --grade 5 --subject ENGLISH --lesson 1");
}

const record = buildNr13GenerationPlan(grade, subject)[lessonNumber - 1];
if (!record) throw new Error("Requested NR-13 lesson was not found");

const payload = record.payload as Record<string, any>;
console.log(JSON.stringify({
  validation: validateNr13Lesson(record),
  contentId: record.contentId,
  title: payload.title,
  grade: record.grade,
  subject: record.subject,
  strand: payload.strand,
  lessonStage: payload.lessonStage,
  objective: payload.objective,
  authorityCodes: payload.metadata?.authorityCodes,
  authorityTrace: payload.authorityTrace,
  prerequisites: payload.prerequisites,
  nextConcepts: payload.nextConcepts,
  assessment: payload.assessmentPlan?.lessonQuiz?.items,
}, null, 2));
console.log("\n--- body_standard ---\n");
console.log(payload.body_standard);
console.log("\n--- body_block ---\n");
console.log(payload.body_block);
