// Check if hero lessons are accessible to demo student
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { prisma } from '@/lib/db';

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'student1@cha.edu.lr' }, select: { id: true, schoolId: true } });
  if (!user) { console.log('student1@cha.edu.lr not found'); await prisma.$disconnect(); return; }
  console.log('Student user id:', user.id);

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true, enrollments: { select: { classId: true } } },
  });
  if (!student) { console.log('No student record'); await prisma.$disconnect(); return; }
  const classIds = student.enrollments.map(e => e.classId);
  console.log('Student enrolled in classIds:', classIds);

  // Find any ScheduledWork for hero lessons in student's classes
  const heroSW = await prisma.scheduledWork.findMany({
    where: { content: { contentId: { startsWith: 'hero-' } }, classId: { in: classIds } },
    select: { id: true, content: { select: { contentId: true } } },
    take: 5,
  });
  console.log('\nHero ScheduledWork in student classes:', heroSW.length);

  // Find all ScheduledWork for hero lessons anywhere
  const allHero = await prisma.scheduledWork.findMany({
    where: { content: { contentId: { startsWith: 'hero-' } } },
    select: { id: true, classId: true, content: { select: { contentId: true } } },
    take: 5,
  });
  console.log('All hero ScheduledWork:', allHero.length, 'classIds:', [...new Set(allHero.map(sw => sw.classId))]);

  // Find today's ScheduledWork for student's classes
  const start = new Date(); start.setUTCHours(0,0,0,0);
  const end = new Date(start.getTime() + 86400000);
  const todaySW = await prisma.scheduledWork.findMany({
    where: { classId: { in: classIds }, scheduledDate: { gte: start, lt: end } },
    select: { id: true, content: { select: { contentId: true, title: true } } },
    take: 5,
  });
  console.log('\nToday ScheduledWork for student:', todaySW.length);
  todaySW.forEach(sw => console.log('  ID:', sw.id, '| content:', sw.content?.contentId?.slice(0,40)));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
