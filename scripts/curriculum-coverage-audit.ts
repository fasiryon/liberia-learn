// Run with: npx dotenv -e .env.production -- npx tsx scripts/curriculum-coverage-audit.ts
// Requires production DATABASE_URL or DIRECT_URL.

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { prisma } from "@/lib/prisma";

const GRADES = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12"];
const SUBJECTS = ["MATH", "SCIENCE", "LITERACY", "ENGLISH", "SOCIAL_STUDIES", "CIVICS", "CS", "ENGINEERING"];

async function main() {
  console.log("\n=== CURRICULUM COVERAGE (APPROVED lessons) ===\n");
  console.log("         " + SUBJECTS.map((s) => s.slice(0, 6).padEnd(8)).join(""));

  for (const grade of GRADES) {
    const row = await Promise.all(
      SUBJECTS.map((subject) => prisma.lesson.count({ where: { grade, subject, status: "APPROVED" } }))
    );
    const cols = row.map((n) => (n === 0 ? "  ✗   " : n < 15 ? `  ${n}⚠  ` : `  ${n}✓ `));
    console.log(grade.padEnd(8) + cols.join(""));
  }

  const total = await prisma.lesson.count({ where: { status: "APPROVED" } });
  const needsReview = await prisma.lesson.count({ where: { status: "NEEDS_REVIEW" } });
  const pending = await prisma.lesson.count({ where: { status: "PENDING" } });
  const pendingAudio = await prisma.lesson.count({ where: { status: "APPROVED", audioUrl: null } });

  console.log("\n=== PIPELINE STATUS ===");
  console.log("APPROVED:", total);
  console.log("NEEDS_REVIEW:", needsReview);
  console.log("PENDING:", pending);
  console.log("APPROVED but no audio:", pendingAudio);
  console.log("\nLegend: ✗ = zero  ⚠ = <15 (below national gate)  ✓ = ≥15");
}

main().catch(console.error).finally(() => prisma.$disconnect());
