// prismaSave.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const args = require("minimist")(process.argv.slice(2));
(async () => {
  await prisma.agentResult.create({
    data: {
      ewoId: args.ewo,
      agentName: args.agent,
      status: args.status,
      output: args.output
    },
  });
  await prisma.$disconnect();
})();
