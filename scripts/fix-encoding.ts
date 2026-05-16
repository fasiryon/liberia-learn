// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REPLACEMENTS: Array<[string, string]> = [
  ["â€”", "-"],
  ["â€“", "-"],
  ["â€˜", "'"],
  ["â€™", "'"],
  ['â€œ', '"'],
  ['â€', '"'],
  ["â€¢", "•"],
  ["â†’", "->"],
  ["Ã—", "x"],
  ["Â·", "·"],
  ["Â ", " "],
  ["Â", ""],
];

function repairEncoding(value: string): string {
  let repaired = value;

  for (const [broken, fixed] of REPLACEMENTS) {
    repaired = repaired.split(broken).join(fixed);
  }

  return repaired.normalize("NFC").trim();
}

function collectChanges<T extends { id: string; name: string | null }>(rows: T[]) {
  return rows
    .filter((row) => typeof row.name === "string" && row.name.length > 0)
    .map((row) => ({
      id: row.id,
      before: row.name as string,
      after: repairEncoding(row.name as string),
    }))
    .filter((row) => row.before !== row.after);
}

async function main() {
  console.log("[fix-encoding] Safety check: back up the database and verify on staging before production.");

  const [schools, classes, users] = await Promise.all([
    prisma.school.findMany({ select: { id: true, name: true } }),
    prisma.class.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const schoolChanges = collectChanges(schools);
  const classChanges = collectChanges(classes);
  const userChanges = collectChanges(users);
  const allChanges = [
    ...schoolChanges.map((change) => ({ model: "School", ...change })),
    ...classChanges.map((change) => ({ model: "Class", ...change })),
    ...userChanges.map((change) => ({ model: "User", ...change })),
  ];

  if (allChanges.length === 0) {
    console.log("[fix-encoding] No broken encoding found in School, Class, or User names.");
    return;
  }

  console.log(`[fix-encoding] Found ${allChanges.length} records to update.`);
  console.log("[fix-encoding] Sample preview:");
  for (const sample of allChanges.slice(0, 10)) {
    console.log(`  ${sample.model} ${sample.id}: "${sample.before}" -> "${sample.after}"`);
  }

  await prisma.$transaction([
    ...schoolChanges.map((change) =>
      prisma.school.update({
        where: { id: change.id },
        data: { name: change.after },
      })
    ),
    ...classChanges.map((change) =>
      prisma.class.update({
        where: { id: change.id },
        data: { name: change.after },
      })
    ),
    ...userChanges.map((change) =>
      prisma.user.update({
        where: { id: change.id },
        data: { name: change.after },
      })
    ),
  ]);

  console.log(
    `[fix-encoding] Updated ${schoolChanges.length} schools, ${classChanges.length} classes, and ${userChanges.length} users.`
  );
}

main()
  .catch((error) => {
    console.error("[fix-encoding] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
