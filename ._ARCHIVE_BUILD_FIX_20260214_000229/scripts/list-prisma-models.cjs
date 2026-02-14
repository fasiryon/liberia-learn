const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const models = Object.keys(p).filter(
    (k) => p[k] && typeof p[k].count === "function"
  );
  console.log("Prisma models with count():", models);
  await p.$disconnect();
})();
