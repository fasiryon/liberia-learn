// Run with: npx dotenv -e .env.production -- npx tsx scripts/curriculum-coverage-audit.ts
// Requires production DATABASE_URL or DIRECT_URL.
// CurriculumContent.grade is Int (1-12), subject is String.

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { prisma } from "@/lib/prisma";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SUBJECTS = [
  "MATH",
  "ENGLISH",
  "LITERACY",
  "SCIENCE",
  "SOCIAL_STUDIES",
  "CIVICS",
  "COMPUTER_SCIENCE",
  "ENGINEERING_FOUNDATIONS",
];
const APPROVED = { in: ["APPROVED", "published"] };
const NATIONAL_GATE = 15;

async function main() {
  console.log("\n=== CURRICULUM COVERAGE (APPROVED + published lessons) ===\n");
  const header = "Grade    " + SUBJECTS.map((s) => s.slice(0, 7).padEnd(9)).join("");
  console.log(header);

  let passingCells = 0;
  const deserts: string[] = [];
  const warn: string[] = [];

  for (const grade of GRADES) {
    const row = await Promise.all(
      SUBJECTS.map((subject) =>
        prisma.curriculumContent.count({ where: { grade, subject, status: APPROVED } })
      )
    );
    const cols = row.map((n, i) => {
      const cell = `${SUBJECTS[i]}:G${grade}`;
      if (n === 0) { deserts.push(cell); return "  ✗    "; }
      if (n < NATIONAL_GATE) { warn.push(`${cell}(${n})`); return `  ${n}⚠  `.padEnd(7); }
      passingCells++;
      return `  ${n}✓ `.padEnd(7);
    });
    console.log(`G${String(grade).padEnd(6)}  ${cols.join("")}`);
  }

  const totalCells = GRADES.length * SUBJECTS.length;

  const total = await prisma.curriculumContent.count({ where: { status: APPROVED } });
  const needsReview = await prisma.curriculumContent.count({ where: { status: "NEEDS_REVIEW" } });
  const pendingCount = await prisma.curriculumContent.count({ where: { status: "PENDING" } });
  const noAudio = await prisma.curriculumContent.count({
    where: { status: APPROVED, audioAssets: { none: {} } },
  });

  console.log("\n=== PIPELINE STATUS ===");
  console.log("APPROVED/published:", total);
  console.log("NEEDS_REVIEW:", needsReview);
  console.log("PENDING:", pendingCount);
  console.log("APPROVED but no audio:", noAudio);
  console.log(`\n=== NATIONAL GATE (≥${NATIONAL_GATE} per cell) ===`);
  console.log(`Cells passing: ${passingCells} / ${totalCells}`);
  console.log(`Cells failing gate (>0 but <${NATIONAL_GATE}):`, warn.length ? warn.join(", ") : "none");
  console.log(`Critical deserts (0 lessons):`, deserts.length ? deserts.join(", ") : "none");
  console.log("\nLegend: ✗ = zero  ⚠ = <15 (below national gate)  ✓ = ≥15");
}

main().catch(console.error).finally(() => prisma.$disconnect());
