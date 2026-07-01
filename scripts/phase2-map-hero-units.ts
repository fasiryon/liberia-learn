/**
 * Phase 2 fix (Item 1): make lesson sequencing visible on the demo path.
 *
 * The demo student (student1@cha.edu.lr) is scheduled `hero-*` showcase lessons,
 * all of which have unitId = null — so the unit-map sidebar and "This week's
 * units" never appear for the exact lessons a principal opens. This script slots
 * each hero lesson into the front of a real, thematically-matching curriculum
 * unit (same subject + grade) by setting unitId + orderInUnit, WITHOUT touching
 * lesson content. Only maps where a clean multi-lesson unit exists; leaves the
 * rest as graceful no-sidebar (documented gap).
 *
 * Run:  npx dotenv -e .env.production -- npx tsx scripts/phase2-map-hero-units.ts [--apply]
 */
import { prisma } from "@/lib/db";

const APPROVED = ["published", "APPROVED"];
const APPLY = process.argv.includes("--apply");

// A "clean" curriculum unit slug looks like `<subject>-g<grade>-<n>-<topic...>`.
// Exclude phase6-*/draft-* buckets which mix unrelated content.
function isCleanUnitSlug(unitId: string): boolean {
  if (/^(phase\d|draft)/i.test(unitId)) return false;
  return /^[a-z_]+-g\d+-\d+-/.test(unitId);
}

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((w) => w.length >= 4)
  );
}

async function main() {
  const heroes = await prisma.curriculumContent.findMany({
    where: { contentId: { startsWith: "hero-" } },
    select: { id: true, contentId: true, title: true, subject: true, grade: true, unitId: true },
  });

  console.log(`Found ${heroes.length} hero lessons.\n`);

  for (const hero of heroes) {
    // Candidate real units: same subject + grade, clean slug, >=2 approved lessons.
    const grouped = await prisma.curriculumContent.groupBy({
      by: ["unitId"],
      where: {
        subject: hero.subject,
        grade: hero.grade,
        unitId: { not: null },
        status: { in: APPROVED },
        contentId: { not: { startsWith: "hero-" } },
      },
      _count: { _all: true },
    });

    const candidates = grouped
      .map((g) => ({ unitId: g.unitId as string, count: g._count._all }))
      .filter((c) => c.unitId && isCleanUnitSlug(c.unitId) && c.count >= 2);

    if (candidates.length === 0) {
      console.log(`✗ ${hero.contentId} (${hero.subject} G${hero.grade}) — no clean matching unit; leaving unmapped.`);
      continue;
    }

    // Prefer the unit whose slug shares the most keywords with the hero title.
    const heroKw = keywords(hero.title ?? hero.contentId);
    let best = candidates[0];
    let bestScore = -1;
    for (const c of candidates) {
      const unitKw = keywords(c.unitId);
      let overlap = 0;
      for (const w of heroKw) if (unitKw.has(w)) overlap += 1;
      // tie-break toward a moderate lesson count (3-8) so the sequence reads well
      const sizeBonus = c.count >= 3 && c.count <= 8 ? 0.5 : 0;
      const score = overlap + sizeBonus;
      if (score > bestScore) { bestScore = score; best = c; }
    }

    console.log(
      `→ ${hero.contentId}\n    maps to unit "${best.unitId}" (${best.count} lessons, kw-overlap=${Math.floor(bestScore)})` +
        (hero.unitId ? `  [was ${hero.unitId}]` : "")
    );

    if (APPLY) {
      // Prepend the hero as the opening lesson of the unit. Shift existing
      // orderInUnit up by 1 so numbering stays 1..N+1 and the hero is lesson 1.
      await prisma.$transaction([
        prisma.$executeRaw`UPDATE "CurriculumContent" SET "orderInUnit" = COALESCE("orderInUnit",0) + 1 WHERE "unitId" = ${best.unitId} AND "contentId" <> ${hero.contentId}`,
        prisma.curriculumContent.update({
          where: { id: hero.id },
          data: { unitId: best.unitId, orderInUnit: 1 },
        }),
      ]);
      console.log(`    ✓ applied.`);
    }
  }

  if (!APPLY) console.log(`\n(dry run — re-run with --apply to write)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
