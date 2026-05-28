/**
 * NR-14 — Audio Coverage Audit
 * Shows per-grade × per-subject audio coverage for APPROVED lessons.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/audio-coverage-audit.ts
 */
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
function cleanEnv(key: string) {
  if (process.env[key]) process.env[key] = process.env[key]!.replace(/^["']|["']$/g, "");
}
cleanEnv("DATABASE_URL");

import { prisma } from "@/lib/db";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SUBJECTS = [
  "MATH",
  "SCIENCE",
  "LITERACY",
  "ENGLISH",
  "SOCIAL_STUDIES",
  "CIVICS",
  "COMPUTER_SCIENCE",
  "ENGINEERING_FOUNDATIONS",
] as const;

const ABBREV: Record<string, string> = {
  MATH:                    "MATH    ",
  SCIENCE:                 "SCI     ",
  LITERACY:                "LIT     ",
  ENGLISH:                 "ENG     ",
  SOCIAL_STUDIES:          "SOC_STU ",
  CIVICS:                  "CIVICS  ",
  COMPUTER_SCIENCE:        "CS      ",
  ENGINEERING_FOUNDATIONS: "ENGRG   ",
};

async function main() {
  console.log("\n=== NR-14 AUDIO COVERAGE AUDIT ===\n");
  console.log("       " + SUBJECTS.map((s) => ABBREV[s]).join(" "));

  let totalApproved = 0;
  let totalWithAudio = 0;

  const rows: string[] = [];

  for (const grade of GRADES) {
    const cols: string[] = [];
    for (const subject of SUBJECTS) {
      const approved = await prisma.curriculumContent.count({
        where: { grade, subject, status: "APPROVED" },
      });
      const withAudio = await prisma.curriculumContent.count({
        where: {
          grade,
          subject,
          status: "APPROVED",
          audioAssets: { some: { status: "GENERATED" } },
        },
      });
      totalApproved += approved;
      totalWithAudio += withAudio;

      const pct = approved > 0 ? Math.round((withAudio / approved) * 100) : -1;
      let cell: string;
      if (pct === -1) cell = "  —     "; // no lessons
      else if (pct === 0) cell = "  ✗     ";
      else if (pct < 50)  cell = `  ${pct}%⚠   `.slice(0, 8);
      else if (pct < 100) cell = `  ${pct}%    `.slice(0, 8);
      else                cell = " 100%✓  ";
      cols.push(cell);
    }
    rows.push(`G${String(grade).padEnd(3)}   ` + cols.join(" "));
  }

  for (const row of rows) console.log(row);

  const overall = totalApproved > 0
    ? Math.round((totalWithAudio / totalApproved) * 100)
    : 0;

  console.log(`\nOverall audio coverage: ${totalWithAudio}/${totalApproved} (${overall}%)`);
  console.log(`Remaining: ${totalApproved - totalWithAudio} lessons need audio`);

  // Per-subject summary
  console.log("\n=== PER-SUBJECT BREAKDOWN ===\n");
  console.log("Subject                   | Approved | With Audio | Coverage");
  console.log("--------------------------|----------|------------|----------");

  for (const subject of SUBJECTS) {
    const approved = await prisma.curriculumContent.count({
      where: { subject, status: "APPROVED" },
    });
    const withAudio = await prisma.curriculumContent.count({
      where: {
        subject,
        status: "APPROVED",
        audioAssets: { some: { status: "GENERATED" } },
      },
    });
    const pct = approved > 0 ? Math.round((withAudio / approved) * 100) : 0;
    console.log(
      `${subject.padEnd(26)}| ${String(approved).padStart(8)} | ${String(withAudio).padStart(10)} | ${pct}%`
    );
  }

  // Priority 1 readiness check
  const p1Subjects = ["MATH", "SCIENCE", "LITERACY"];
  const p1Grades = [1, 2, 3, 4, 5, 6];
  let p1Approved = 0, p1WithAudio = 0;
  for (const subject of p1Subjects) {
    for (const grade of p1Grades) {
      p1Approved += await prisma.curriculumContent.count({
        where: { grade, subject, status: "APPROVED" },
      });
      p1WithAudio += await prisma.curriculumContent.count({
        where: {
          grade,
          subject,
          status: "APPROVED",
          audioAssets: { some: { status: "GENERATED" } },
        },
      });
    }
  }
  const p1Pct = p1Approved > 0 ? Math.round((p1WithAudio / p1Approved) * 100) : 0;
  console.log(`\n=== PRIORITY 1 (MATH/SCIENCE/LITERACY G1-G6) ===`);
  console.log(`${p1WithAudio}/${p1Approved} (${p1Pct}%) — Gate: ≥50% to close NR-14`);
  if (p1Pct >= 50) console.log("✓ NR-14 GATE: PASSED");
  else console.log(`✗ NR-14 GATE: ${50 - p1Pct}% to go`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
