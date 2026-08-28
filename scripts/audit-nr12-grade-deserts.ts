import {
  NR12_SUBJECTS,
  NR12_TARGET_LESSONS,
  buildNr12GenerationPlan,
  validateNr12Lesson,
} from "../lib/curriculum/nr12GradeDeserts";

/** Read-only repository audit. It never opens Prisma or mutates staging/production. */
function main() {
  const rows: string[] = [];
  let failed = false;

  for (const grade of [2, 9]) {
    for (const subject of NR12_SUBJECTS) {
      const lessons = buildNr12GenerationPlan(grade, subject);
      const results = lessons.map(validateNr12Lesson);
      const passed = lessons.length === NR12_TARGET_LESSONS && results.every((result) => result.passed);
      if (!passed) failed = true;
      rows.push([
        grade,
        subject,
        lessons.length,
        results.filter((result) => result.passed).length,
        Math.min(...results.map((result) => result.wordCount)),
        passed ? "COMPLETE" : results.flatMap((result) => result.reasons).join(","),
      ].join("\t"));
    }
  }

  console.log("GRADE\tSUBJECT\tLESSONS\tQUALITY_PASS\tMIN_WORDS\tSTATUS");
  console.log(rows.join("\n"));
  if (failed) process.exitCode = 1;
}

main();
