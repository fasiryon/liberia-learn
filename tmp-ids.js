const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const classes = await p.class.findMany({ select: { id: true, name: true }, take: 5 });
  const students = await p.student.findMany({ select: { id: true, userId: true }, take: 5 });

  console.log("CLASSES:", classes);
  console.log("STUDENTS:", students);

  await p.$disconnect();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
