const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  console.log("User count:", await p.user.count());
  await p.$disconnect();
})();
