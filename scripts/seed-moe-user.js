const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
async function main() {
  const prisma = new PrismaClient();
  const pwd = await bcrypt.hash('MOESeed2026!', 10);
  await prisma.user.upsert({
    where: { email: 'official1@moe.gov.lr' },
    update: { hashedPwd: pwd, role: 'MOE_OFFICIAL' },
    create: { email: 'official1@moe.gov.lr', name: 'MOE Official', role: 'MOE_OFFICIAL', hashedPwd: pwd }
  });
  console.log('Done');
  await prisma.$disconnect();
}
main().catch(console.error);
