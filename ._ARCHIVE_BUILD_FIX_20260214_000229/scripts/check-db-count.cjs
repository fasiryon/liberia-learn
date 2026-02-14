const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  console.log("CurriculumContent:", await p.curriculumContent.count());
  await p.$disconnect();
})();
