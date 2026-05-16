// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
async function main() {
  const prisma = new PrismaClient();
  const moePassword = process.env.DEMO_MOE_PASSWORD || process.env.E2E_DEMO_MOE_PASSWORD;
  if (!moePassword) {
    throw new Error('DEMO_MOE_PASSWORD or E2E_DEMO_MOE_PASSWORD is required.');
  }
  const moeEmail = process.env.E2E_DEMO_MOE_EMAIL || ['official1', 'moe.gov.lr'].join('@');
  const pwd = await bcrypt.hash(moePassword, 10);
  await prisma.user.upsert({
    where: { email: moeEmail },
    update: { hashedPwd: pwd, role: 'MOE_OFFICIAL' },
    create: { email: moeEmail, name: 'MOE Official', role: 'MOE_OFFICIAL', hashedPwd: pwd }
  });
  console.log('Done');
  await prisma.$disconnect();
}
main().catch(console.error);
