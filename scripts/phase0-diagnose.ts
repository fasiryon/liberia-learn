// Phase 0 diagnostic — prints field shape of an existing hero lesson
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { prisma } from '@/lib/db';

async function main() {
  const heroLesson = await prisma.curriculumContent.findFirst({
    where: { contentId: { startsWith: 'hero-' } },
    select: { contentId: true, payload: true, version: true, status: true },
  });

  if (!heroLesson) {
    console.log('NO HERO LESSONS FOUND IN DB');
    await prisma.$disconnect();
    process.exit(0);
  }

  const p = heroLesson.payload as Record<string, unknown>;
  console.log('\n=== Hero lesson found ===');
  console.log('contentId:', heroLesson.contentId);
  console.log('status:', heroLesson.status, '| version:', heroLesson.version);
  console.log('payload top-level keys:', Object.keys(p));

  const body = typeof p.body === 'string' ? p.body : '';
  const bodyStd = typeof p.body_standard === 'string' ? p.body_standard : '';
  const bodyBlock = typeof p.body_block === 'string' ? p.body_block : '';
  const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  console.log('\n=== Body fields ===');
  console.log('body word count:           ', wc(body));
  console.log('body_standard word count:  ', wc(bodyStd));
  console.log('body_block word count:     ', wc(bodyBlock));
  console.log('body === body_standard:    ', body === bodyStd);
  console.log('body === body_block:       ', body === bodyBlock);
  console.log('\n=== Problem sets ===');
  const ps = Array.isArray(p.problemSets) ? p.problemSets as Array<Record<string,unknown>> : [];
  console.log('problemSets count:', ps.length);
  if (ps[0]) console.log('problemSets[0] keys:', Object.keys(ps[0]));
  console.log('answerKey in problemSets[0]:', ps[0] ? 'answerKey' in ps[0] : 'n/a');
  console.log('\n=== Other fields ===');
  console.log('takeawaySummary length:', typeof p.takeawaySummary === 'string' ? p.takeawaySummary.length : 0);
  console.log('objectives count:', Array.isArray(p.objectives) ? (p.objectives as unknown[]).length : 0);
  console.log('metadata:', JSON.stringify(p.metadata ?? {}));

  // Check a V1 lesson (non-hero) for comparison
  const v1 = await prisma.curriculumContent.findFirst({
    where: { contentId: { not: { startsWith: 'hero-' } }, status: 'published' },
    select: { contentId: true, payload: true },
  });
  if (v1) {
    const vp = v1.payload as Record<string, unknown>;
    const vb = typeof vp.body === 'string' ? vp.body : '';
    const vbs = typeof vp.body_standard === 'string' ? vp.body_standard : '';
    console.log('\n=== V1 lesson comparison ===');
    console.log('contentId:', v1.contentId);
    console.log('payload keys:', Object.keys(vp));
    console.log('body word count:', wc(vb));
    console.log('body_standard word count:', wc(vbs));
    console.log('body === body_standard:', vb === vbs);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
