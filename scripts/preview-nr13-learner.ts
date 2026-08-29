import { buildNr13GenerationPlan } from "../lib/curriculum/nr13Grades58";
import { projectStudentLessonPayload } from "../lib/curriculum/studentLessonProjection";

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const grade = Number(option("--grade", "5"));
const subject = option("--subject", "ENGLISH") as Parameters<typeof buildNr13GenerationPlan>[1];
const lessonNumber = Number(option("--lesson", "1"));
const lesson = buildNr13GenerationPlan(grade, subject)[lessonNumber - 1];

if (!lesson) {
  throw new Error(`No NR-13 lesson found for grade ${grade}, subject ${subject}, lesson ${lessonNumber}.`);
}

const learnerPayload = projectStudentLessonPayload(lesson.payload);
console.log(JSON.stringify({
  contentId: lesson.contentId,
  title: learnerPayload.title,
  grade: learnerPayload.grade,
  subject: learnerPayload.subject,
  studentReady: learnerPayload.studentReady,
  body: learnerPayload.body_standard,
}, null, 2));
