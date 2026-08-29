import {
  NR13_GRADES,
  NR13_SUBJECTS,
  NR13_TARGET_LESSONS,
  buildNr13CoverageMatrix,
  buildNr13GenerationPlan,
  validateNr13Lesson,
} from "../lib/curriculum/nr13Grades58";

/** Read-only NR-13 audit. It never opens Prisma or mutates staging/production. */
function main() {
  const rows = buildNr13CoverageMatrix();
  const failures: string[] = [];
  for (const grade of NR13_GRADES) {
    for (const subject of NR13_SUBJECTS) {
      const lessons = buildNr13GenerationPlan(grade, subject);
      const results = lessons.map(validateNr13Lesson);
      const row = rows.find((item) => item.grade === grade && item.subject === subject);
      const passed = lessons.length === NR13_TARGET_LESSONS && results.every((result) => result.passed);
      if (!passed) failures.push(`G${grade} ${subject}: ${results.flatMap((result) => result.reasons).join(",") || "lesson_count"}`);
      if (!row || row.qualityStatus !== "COMPLETE") failures.push(`G${grade} ${subject}: matrix_quality=${row?.qualityStatus ?? "missing"}`);
    }
  }

  console.log("GRADE\tSUBJECT\tSTRAND\tSTANDARDS\tUNITS\tLESSONS\tPRACTICE\tASSESSMENT\tPREREQUISITE\tNEXT_CONCEPT\tAUTHORITY\tQUALITY_STATUS");
  for (const row of rows) {
    console.log([
      row.grade,
      row.subject,
      row.strand,
      row.standards.join(","),
      row.units,
      row.lessons,
      row.practice,
      row.assessment,
      row.prerequisite,
      row.nextConcept,
      row.authority,
      row.qualityStatus,
    ].join("\t"));
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
}

main();
