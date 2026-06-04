if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const lessons = await p.curriculumContent.findMany({
    where: { contentId: { startsWith: 'hero-' }, isHero: true },
    select: { contentId: true, payload: true }
  });
  for (const lesson of lessons) {
    const payload = lesson.payload as Record<string, unknown>;
    const pseudoLabs = Array.isArray(payload.pseudoLabs) ? payload.pseudoLabs as unknown[] : [];
    const labs = Array.isArray(payload.labs) ? payload.labs as unknown[] : [];
    const activities = Array.isArray(payload.activities) ? payload.activities as unknown[] : [];
    console.log(`${lesson.contentId.slice(0,60).padEnd(62)} pseudoLabs:${pseudoLabs.length} labs:${labs.length} activities:${activities.length}`);
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
