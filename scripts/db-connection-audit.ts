// Run with: npx dotenv -e .env.production -- npx tsx scripts/db-connection-audit.ts
// Requires DIRECT_URL (or DATABASE_URL) pointing to production Supabase.

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { prisma } from "@/lib/prisma";

async function main() {
  const pooled = process.env.DATABASE_URL?.includes("6543") ? "PgBouncer (pooled)" : "Direct";
  const direct = process.env.DIRECT_URL?.includes("5432") ? "Direct (5432)" : "Not set";

  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) FROM pg_stat_activity
    WHERE datname = current_database()
  `;
  const maxConn = await prisma.$queryRaw<{ setting: string }[]>`SHOW max_connections`;
  const dbSize = await prisma.$queryRaw<{ pg_size_pretty: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database()))
  `;

  const users = await prisma.user.count();
  const schools = await prisma.school.count();
  const lessons = await prisma.lesson.count();
  const approvedLessons = await prisma.lesson.count({ where: { status: "APPROVED" } });

  console.log("\n=== DATABASE BASELINE ===");
  console.log("DATABASE_URL mode:", pooled);
  console.log("DIRECT_URL mode:", direct);
  console.log("Active connections:", result[0].count.toString());
  console.log("Max connections:", maxConn[0].setting);
  console.log("DB size:", dbSize[0].pg_size_pretty);
  console.log("\n=== DATA COUNTS ===");
  console.log("Users:", users);
  console.log("Schools:", schools);
  console.log("Total lessons:", lessons);
  console.log("APPROVED lessons:", approvedLessons);
  console.log("Pending/review:", lessons - approvedLessons);
}

main().catch(console.error).finally(() => prisma.$disconnect());
