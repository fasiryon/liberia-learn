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

  const totalContent = await prisma.curriculumContent.count();
  const approvedContent = await prisma.curriculumContent.count({
    where: { status: { in: ["APPROVED", "published"] } },
  });
  const needsReview = await prisma.curriculumContent.count({ where: { status: "NEEDS_REVIEW" } });
  const pending = await prisma.curriculumContent.count({ where: { status: "PENDING" } });
  const noAudio = await prisma.curriculumContent.count({
    where: {
      status: { in: ["APPROVED", "published"] },
      audioAssets: { none: {} },
    },
  });

  console.log("\n=== DATABASE BASELINE ===");
  console.log("DATABASE_URL mode:", pooled);
  console.log("DIRECT_URL mode:", direct);
  console.log("Active connections:", result[0].count.toString());
  console.log("Max connections:", maxConn[0].setting);
  console.log("DB size:", dbSize[0].pg_size_pretty);
  console.log("\n=== DATA COUNTS ===");
  console.log("Users:", users);
  console.log("Schools:", schools);
  console.log("Total curriculum content:", totalContent);
  console.log("APPROVED/published:", approvedContent);
  console.log("NEEDS_REVIEW:", needsReview);
  console.log("PENDING:", pending);
  console.log("APPROVED but no audio:", noAudio);
}

main().catch(console.error).finally(() => prisma.$disconnect());
