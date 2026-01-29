const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const u = await p.user.findUnique({ where: { email: "teacher1@liberialearn.dev" } });
  console.log(u ? { email: u.email, role: u.role, hasHashedPwd: !!u.hashedPwd } : "NOT FOUND");
  await p.$disconnect();
})();
