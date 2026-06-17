/**
 * Read-only diagnostic: dump all ScheduledWork for the CHA demo class across a
 * 14-day window, grouped by date, flagging duplicate (date, periodNumber) pairs.
 *
 * Purpose: determine whether the refresh-demo-schedule cron has collided with
 * the timetable-driven backfill (duplicate periods), and whether the schedule
 * is currently clean. Also reports the pinned CHA_DEMO_SW_ID state.
 *
 *   npx dotenv -e .env.production -- npx tsx scripts/diag-demo-window.ts
 */
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { prisma } from "../lib/prisma";

const CLASS_ID = "cha-class-grade9a";
const CHA_DEMO_SW_ID = "cha-demo-student1-multimedia-lesson";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 32));
  const todayKey = dayKey(now);
  console.log(`today=${todayKey}  window=${dayKey(start)}..${dayKey(end)}`);

  const sw = await prisma.scheduledWork.findMany({
    where: { classId: CLASS_ID, scheduledDate: { gte: start, lte: end } },
    orderBy: [{ scheduledDate: "asc" }, { periodNumber: "asc" }],
    select: {
      id: true,
      periodNumber: true,
      startTime: true,
      scheduledDate: true,
      content: { select: { subject: true, grade: true } },
    },
  });

  const byDate = new Map<string, typeof sw>();
  for (const s of sw) {
    const k = dayKey(s.scheduledDate);
    if (!byDate.has(k)) byDate.set(k, [] as any);
    byDate.get(k)!.push(s);
  }

  let dupTotal = 0;
  for (const [date, items] of [...byDate.entries()].sort()) {
    const periodCounts = new Map<number, number>();
    for (const s of items) {
      const p = s.periodNumber ?? -1;
      periodCounts.set(p, (periodCounts.get(p) ?? 0) + 1);
    }
    const dupes = [...periodCounts.entries()].filter(([, c]) => c > 1);
    dupTotal += dupes.reduce((a, [, c]) => a + (c - 1), 0);
    const flag = date === todayKey ? " <-- TODAY" : "";
    const dupFlag = dupes.length ? `  ⚠ DUP periods: ${dupes.map(([p, c]) => `P${p}×${c}`).join(", ")}` : "";
    const subj = items.map((s) => `P${s.periodNumber}:${s.content?.subject ?? "?"}`).join(" ");
    console.log(`  ${date} (${items.length} SW)${flag}${dupFlag}`);
    console.log(`      ${subj}`);
  }

  console.log(`\nDuplicate period instances across window: ${dupTotal}`);

  const pinned = await prisma.scheduledWork.findUnique({
    where: { id: CHA_DEMO_SW_ID },
    select: { id: true, scheduledDate: true, classId: true },
  });
  console.log(
    pinned
      ? `Pinned CHA_DEMO_SW_ID exists: date=${dayKey(pinned.scheduledDate)} class=${pinned.classId}`
      : `Pinned CHA_DEMO_SW_ID (${CHA_DEMO_SW_ID}): NOT FOUND`
  );
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
