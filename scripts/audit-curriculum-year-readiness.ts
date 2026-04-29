import { getYearReadinessReport, mapExistingCurriculumToYearPlan } from "@/lib/curriculum/yearPlan";

async function main() {
  const shouldMap = process.argv.includes("--map");
  const summaryOnly = process.argv.includes("--summary");
  if (shouldMap) {
    const result = await mapExistingCurriculumToYearPlan();
    console.log(JSON.stringify({
      action: "map_existing_curriculum",
      generatedContent: false,
      duplicatedLessons: false,
      mappedLessons: result.mappedLessons,
      decisions: result.decisions,
    }, null, 2));
  }

  const report = await getYearReadinessReport();
  if (summaryOnly) {
    const classifications = report.reduce<Record<string, number>>((acc, row) => {
      acc[row.classification] = (acc[row.classification] ?? 0) + 1;
      return acc;
    }, {});
    const highestPriorityGaps = [...report]
      .filter((row) => row.classification !== "STRONG")
      .sort((left, right) =>
        left.readinessPct - right.readinessPct ||
        right.missingWeeks.length - left.missingWeeks.length ||
        left.grade - right.grade ||
        left.subject.localeCompare(right.subject)
      )
      .slice(0, 10)
      .map((row) => ({
        grade: row.grade,
        subject: row.subject,
        mappedLessons: row.mappedLessons,
        readinessPct: row.readinessPct,
        missingWeeks: row.missingWeeks.length,
        classification: row.classification,
      }));

    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      targets: {
        weeksPerGradeSubject: 36,
        lessonsPerWeek: 5,
        lessonsPerGradeSubject: 180,
      },
      totals: {
        groups: report.length,
        totalLessons: report.reduce((sum, row) => sum + row.totalLessons, 0),
        mappedLessons: report.reduce((sum, row) => sum + row.mappedLessons, 0),
        minReadinessPct: Math.min(...report.map((row) => row.readinessPct)),
        maxReadinessPct: Math.max(...report.map((row) => row.readinessPct)),
        classifications,
      },
      highestPriorityGaps,
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    targets: {
      weeksPerGradeSubject: 36,
      lessonsPerWeek: 5,
      lessonsPerGradeSubject: 180,
    },
    rows: report,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
