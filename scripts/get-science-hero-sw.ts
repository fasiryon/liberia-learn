if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const sw = await p.scheduledWork.findFirst({
    where: { content: { contentId: 'hero-science-g5-living-things-and-their-habitats' } },
    select: { id: true, classId: true, scheduledDate: true }
  });
  console.log('SW for G5 science hero:', JSON.stringify(sw));
  // Also get the CurriculumContent id
  const cc = await p.curriculumContent.findUnique({
    where: { contentId: 'hero-science-g5-living-things-and-their-habitats' },
    select: { id: true }
  });
  console.log('CurriculumContent id:', cc?.id);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
