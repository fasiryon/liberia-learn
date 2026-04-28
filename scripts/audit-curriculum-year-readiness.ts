import { getYearReadinessReport, mapExistingCurriculumToYearPlan } from "@/lib/curriculum/yearPlan";

async function main() {
  const shouldMap = process.argv.includes("--map");
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
