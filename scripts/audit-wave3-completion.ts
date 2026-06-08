// scripts/audit-wave3-completion.ts
// Code-driven verification of all 6 Wave 3 features.
// Run: npx dotenv -e .env.production -- npx tsx scripts/audit-wave3-completion.ts

import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

type CheckResult = { feature: string; check: string; pass: boolean; detail: string };
const results: CheckResult[] = [];

function check(feature: string, name: string, pass: boolean, detail: string) {
  results.push({ feature, check: name, pass, detail });
}

function fileContains(filePath: string, pattern: string | RegExp): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  } catch {
    return false;
  }
}

function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(full);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

function grepInDir(dir: string, pattern: string): string[] {
  const matches: string[] = [];
  if (!fs.existsSync(dir)) return matches;
  const files = findFiles(dir, /\.(ts|tsx)$/);
  for (const f of files) {
    if (fileContains(f, pattern)) matches.push(f);
  }
  return matches;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('WAVE 3 COMPLETION AUDIT');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ═══════════════════════════════════════════════════════════════
  // 3A — Guardian SMS Weekly Digest
  // ═══════════════════════════════════════════════════════════════
  console.log('Checking 3A — Guardian SMS Digest...');

  check('3A', 'composeGuardianDigest exists',
    fs.existsSync('lib/notifications/guardianDigest.ts'),
    'lib/notifications/guardianDigest.ts');

  check('3A', 'Cron route registered',
    fs.existsSync('app/api/cron/guardian-weekly-digest/route.ts'),
    'app/api/cron/guardian-weekly-digest/route.ts');

  check('3A', 'Cron in vercel.json',
    fileContains('vercel.json', 'guardian-weekly-digest'),
    'vercel.json schedule entry');

  check('3A', 'Admin trigger endpoint',
    fs.existsSync('app/api/admin/digest/trigger/route.ts'),
    'app/api/admin/digest/trigger/route.ts');

  check('3A', 'ENGLISH in Subject enum',
    fileContains('prisma/schema.prisma', /enum Subject[\s\S]*ENGLISH/),
    'prisma/schema.prisma');

  const englishHero = await prisma.curriculumContent.findFirst({
    where: { isHero: true, subject: 'ENGLISH' as any }
  }).catch(() => null);
  check('3A', 'ENGLISH hero exists in DB',
    englishHero !== null,
    englishHero ? `id=${englishHero.id}` : 'none found (or DB unreachable)');

  // ═══════════════════════════════════════════════════════════════
  // 3B — MOE Live Dashboard TV Mode
  // ═══════════════════════════════════════════════════════════════
  console.log('Checking 3B — MOE Live Dashboard...');

  const moeLivePages = findFiles('app', /page\.tsx$/).filter(p => p.includes('moe') && p.includes('live'));
  check('3B', '/moe/live page exists',
    moeLivePages.length > 0,
    moeLivePages[0] || 'not found');

  check('3B', '/api/moe/live route exists',
    fs.existsSync('app/api/moe/live/route.ts'),
    'app/api/moe/live/route.ts');

  const signedUrlHelpers = grepInDir('lib', 'createHmac').concat(grepInDir('lib', 'signUrl'));
  check('3B', 'Signed URL helper present',
    signedUrlHelpers.length > 0,
    signedUrlHelpers[0] || 'no HMAC helper found');

  check('3B', 'Press demo seed script',
    fs.existsSync('scripts/seed-press-conference-data.ts'),
    'scripts/seed-press-conference-data.ts');

  // ═══════════════════════════════════════════════════════════════
  // 3C — WhatsApp Certificate Share
  // ═══════════════════════════════════════════════════════════════
  console.log('Checking 3C — WhatsApp Cert Share...');

  const shareButton = grepInDir('components', 'WhatsAppShareButton');
  check('3C', 'WhatsAppShareButton component exists',
    shareButton.length > 0,
    shareButton[0] || 'component not found');

  // CRITICAL: is it actually imported on the certificates page?
  const certPages = findFiles('app', /page\.tsx$/).filter(p => p.includes('certificates'));
  const wiredCertPages = certPages.filter(p => fileContains(p, 'WhatsAppShareButton'));
  check('3C', 'Share button wired to /student/certificates',
    wiredCertPages.length > 0,
    wiredCertPages[0] || 'NOT IMPORTED ON CERT LIST PAGE');

  check('3C', 'OG image route exists',
    fs.existsSync('app/api/certificates/[id]/image/route.ts') ||
    fs.existsSync('app/api/certificates/[id]/image/route.tsx'),
    'app/api/certificates/[id]/image/route.tsx');

  const sharePages = findFiles('app', /page\.tsx$/).filter(p => p.includes('share') && p.includes('certificate'));
  check('3C', 'Share landing page exists',
    sharePages.length > 0,
    sharePages[0] || 'not found');

  const certShareCount = await prisma.certificateShare.count().catch(() => -1);
  check('3C', 'CertificateShare table exists',
    certShareCount >= 0,
    `row count: ${certShareCount}`);

  // ═══════════════════════════════════════════════════════════════
  // 3D — District Competition League
  // ═══════════════════════════════════════════════════════════════
  console.log('Checking 3D — District League...');

  const districtWidget = grepInDir('components', 'DistrictRankWidget');
  check('3D', 'DistrictRankWidget component exists',
    districtWidget.length > 0,
    districtWidget[0] || 'not found');

  const studentDashPages = findFiles('app', /page\.tsx$/).filter(p => {
    const n = p.replace(/\\/g, '/');
    return n.includes('student') && (n.includes('dashboard') || n.endsWith('today/page.tsx') || /student\/page\.tsx$/.test(n));
  });
  const wiredStudentDash = studentDashPages.filter(p => fileContains(p, 'DistrictRankWidget'));
  check('3D', 'DistrictRankWidget wired to student dashboard',
    wiredStudentDash.length > 0,
    wiredStudentDash[0] || 'NOT WIRED TO STUDENT DASHBOARD');

  const teacherDashPages = findFiles('app', /page\.tsx$/).filter(p =>
    p.includes('teacher') && (p.includes('dashboard') || p.match(/teacher[\/\\]page\.tsx$/))
  );
  const wiredTeacherDash = teacherDashPages.filter(p => fileContains(p, 'DistrictRankWidget'));
  check('3D', 'DistrictRankWidget wired to teacher dashboard',
    wiredTeacherDash.length > 0,
    wiredTeacherDash[0] || 'NOT WIRED TO TEACHER DASHBOARD');

  check('3D', 'League district API exists',
    fs.existsSync('app/api/league/district/route.ts'),
    'app/api/league/district/route.ts');

  check('3D', 'Weekly reset cron registered',
    fileContains('vercel.json', 'league-weekly-reset'),
    'vercel.json schedule entry');

  const leagueWeekSnapshot = await prisma.leagueWeekSnapshot.count().catch(() => -1);
  check('3D', 'LeagueWeekSnapshot table exists',
    leagueWeekSnapshot >= 0,
    `row count: ${leagueWeekSnapshot}`);

  // ═══════════════════════════════════════════════════════════════
  // 3E — Offline Lesson Pack ZIP
  // ═══════════════════════════════════════════════════════════════
  console.log('Checking 3E — Offline Pack...');

  const offlinePackCount = await prisma.offlinePack.count().catch(() => -1);
  check('3E', 'OfflinePack table exists',
    offlinePackCount >= 0,
    `row count: ${offlinePackCount}`);

  check('3E', 'Pack generation library exists',
    fs.existsSync('lib/packs/generatePack.ts'),
    'lib/packs/generatePack.ts');

  check('3E', 'Pack API route exists',
    fs.existsSync('app/api/packs/week/route.ts') || fs.existsSync('app/api/packs/route.ts'),
    'app/api/packs/week/route.ts');

  const downloadPackButton = grepInDir('components', 'DownloadPackButton')
    .concat(grepInDir('components', 'Pack'));
  const packComponents = downloadPackButton.filter(f => /Pack/.test(path.basename(f)));
  check('3E', 'Pack download component exists',
    packComponents.length > 0,
    packComponents[0] || 'not found');

  // CRITICAL: button wired to teacher dashboard?
  const wiredTeacherPack = teacherDashPages.filter(p =>
    /DownloadPackButton|download.*pack/i.test(fs.readFileSync(p, 'utf8'))
  );
  check('3E', 'Pack button wired to teacher dashboard',
    wiredTeacherPack.length > 0,
    wiredTeacherPack[0] || 'NOT WIRED TO TEACHER DASHBOARD');

  // CRITICAL: button wired to student today?
  const studentTodayPages = findFiles('app', /page\.tsx$/).filter(p =>
    p.includes('student') && p.includes('today')
  );
  const wiredStudentToday = studentTodayPages.filter(p =>
    /DownloadPackButton|download.*pack/i.test(fs.readFileSync(p, 'utf8'))
  );
  check('3E', 'Pack button wired to student Today',
    wiredStudentToday.length > 0,
    wiredStudentToday[0] || 'NOT WIRED TO STUDENT TODAY');

  const teacherPacksPage = findFiles('app', /page\.tsx$/).filter(p => p.includes('teacher') && p.includes('packs'));
  check('3E', '/teacher/packs history page exists',
    teacherPacksPage.length > 0,
    teacherPacksPage[0] || 'not found');

  const studentPacksPage = findFiles('app', /page\.tsx$/).filter(p => p.includes('student') && p.includes('packs'));
  check('3E', '/student/packs history page exists',
    studentPacksPage.length > 0,
    studentPacksPage[0] || 'not found');

  check('3E', 'stripStudentKeys function exists',
    grepInDir('lib', 'stripStudentKeys').length > 0,
    grepInDir('lib', 'stripStudentKeys')[0] || 'not found');

  // ═══════════════════════════════════════════════════════════════
  // 3F — Teacher Video Upload + Moderation
  // ═══════════════════════════════════════════════════════════════
  console.log('Checking 3F — Teacher Videos...');

  const teacherVideoCount = await prisma.lessonVideo.count().catch(() => -1);
  check('3F', 'LessonVideo (TeacherVideo) table exists',
    teacherVideoCount >= 0,
    `row count: ${teacherVideoCount}`);

  check('3F', 'Video upload API exists',
    fs.existsSync('app/api/teacher/videos/upload/route.ts'),
    'app/api/teacher/videos/upload/route.ts');

  const reviewPage = findFiles('app', /page\.tsx$/).filter(p =>
    p.includes('admin') && p.includes('videos') && p.includes('review')
  );
  check('3F', '/admin/videos/review page exists',
    reviewPage.length > 0,
    reviewPage[0] || 'not found');

  const videoUploadComponent = grepInDir('components', 'TeacherVideoUpload')
    .concat(grepInDir('components', 'MediaRecorder'));
  check('3F', 'Video upload component exists',
    videoUploadComponent.length > 0,
    videoUploadComponent[0] || 'not found');

  // CRITICAL: is the upload UI wired into the teacher lesson view?
  const teacherLessonPages = findFiles('app', /page\.tsx$/).filter(p =>
    p.includes('teacher') && (p.includes('lessons') || p.includes('lesson'))
  );
  const wiredTeacherLesson = teacherLessonPages.filter(p =>
    /TeacherVideoUpload|AddVideo|add.*explanation.*video/i.test(fs.readFileSync(p, 'utf8'))
  );
  check('3F', 'Video upload wired to teacher lesson view',
    wiredTeacherLesson.length > 0,
    wiredTeacherLesson[0] || 'NOT WIRED TO TEACHER LESSON VIEW');

  // Is video playback wired to student lesson view?
  const studentLessonPages = findFiles('app', /page\.tsx$/).filter(p =>
    p.includes('student') && p.includes('lessons')
  );
  const wiredStudentLesson = studentLessonPages.filter(p =>
    /TeacherVideo|teacherVideo|activeVideo/i.test(fs.readFileSync(p, 'utf8'))
  );
  check('3F', 'Video playback wired to student lesson view',
    wiredStudentLesson.length > 0,
    wiredStudentLesson[0] || 'NOT WIRED TO STUDENT LESSON VIEW');

  check('3F', 'Cleanup cron registered',
    fileContains('vercel.json', 'cleanup-rejected-videos'),
    'vercel.json schedule entry');

  // ═══════════════════════════════════════════════════════════════
  // EXTRAS — Navigation gaps from earlier screenshots
  // ═══════════════════════════════════════════════════════════════
  console.log('Checking misc navigation...');

  const aiTutorPage = findFiles('app', /page\.tsx$/).filter(p => p.includes('ai-tutor'));
  if (aiTutorPage[0]) {
    check('NAV', 'AI Tutor has back-to-dashboard link',
      /href=["']\/(dashboard|student|teacher)/.test(fs.readFileSync(aiTutorPage[0], 'utf8')) ||
      /Back to|back-to-/i.test(fs.readFileSync(aiTutorPage[0], 'utf8')),
      aiTutorPage[0]);
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('AUDIT RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const features = ['3A', '3B', '3C', '3D', '3E', '3F', 'NAV'];
  for (const f of features) {
    const feat = results.filter(r => r.feature === f);
    if (feat.length === 0) continue;
    const passed = feat.filter(r => r.pass).length;
    const total = feat.length;
    const status = passed === total ? '✓' : '✗';
    console.log(`${status} ${f} — ${passed}/${total} checks pass`);
    for (const r of feat) {
      const mark = r.pass ? '  ✓' : '  ✗';
      console.log(`${mark} ${r.check}`);
      if (!r.pass) console.log(`      → ${r.detail}`);
    }
    console.log('');
  }

  const totalPass = results.filter(r => r.pass).length;
  const totalCheck = results.length;
  console.log(`\nTOTAL: ${totalPass}/${totalCheck} checks pass`);
  console.log(`FAILED: ${results.filter(r => !r.pass).map(r => `${r.feature}/${r.check}`).join(', ') || 'none'}`);

  await prisma.$disconnect();
  process.exit(results.some(r => !r.pass) ? 1 : 0);
}

main();
