import { prisma } from "@/lib/db";

async function main() {
  const rows = await prisma.$queryRaw<Array<{ status: string; n: bigint }>>`
    SELECT status, COUNT(*)::int as n FROM "CurriculumContent" GROUP BY status ORDER BY n DESC`;
  for (const r of rows) console.log(`${r.status}: ${r.n}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
