const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  console.log(Object.keys(p).filter(k => typeof p[k]?.count === "function"));
  await p.$disconnect();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
