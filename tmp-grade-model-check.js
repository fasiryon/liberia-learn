const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const models = [
    "gradeCategory",
    "classGradePolicy",
    "gradableItem",
    "gradableSubmission",
    "gradeRecord",
    "gradeAppeal",
    "gradeAuditFlag",
    "gradeRevision"
  ];

  console.log(
    "Models present:",
    models.filter(m => typeof p[m]?.count === "function")
  );

  await p.$disconnect();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
