import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function run() {
  const statuses = await p.curriculumContent.groupBy({
    by: ["status"],
    _count: { contentId: true },
  });
  process.stdout.write("BY_STATUS:" + JSON.stringify(statuses) + "\n");

  const byGrade = await p.curriculumContent.groupBy({
    by: ["grade", "subject", "status"],
    _count: { contentId: true },
    orderBy: [{ grade: "asc" }, { subject: "asc" }],
  });
  process.stdout.write("BY_GRADE_SUBJECT:" + JSON.stringify(byGrade) + "\n");

  await p.$disconnect();
}
run().catch((e) => {
  process.stderr.write("ERR:" + e.message + "\n");
  process.exit(1);
});
