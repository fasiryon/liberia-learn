import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log(' Seeding LiberiaLearn...');

  const teacherPwd = await bcrypt.hash('teach123', 10);
  const studentPwd = await bcrypt.hash('student123', 10);

  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher1@liberialearn.dev' },
    update: { hashedPwd: teacherPwd, role: 'TEACHER', name: 'Ms. Johnson', emailVerified: new Date() },
    create: { email: 'teacher1@liberialearn.dev', hashedPwd: teacherPwd, role: 'TEACHER', name: 'Ms. Johnson', emailVerified: new Date() }
  });

  const studentUser = await prisma.user.upsert({
    where: { email: 'student1@liberialearn.dev' },
    update: { hashedPwd: studentPwd, role: 'STUDENT', name: 'Massa Kamara', emailVerified: new Date() },
    create: { email: 'student1@liberialearn.dev', hashedPwd: studentPwd, role: 'STUDENT', name: 'Massa Kamara', emailVerified: new Date() }
  });

  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: { county: 'Montserrado', community: 'New Kru Town' },
    create: { userId: studentUser.id, county: 'Montserrado', community: 'New Kru Town' }
  });

  let school = await prisma.school.findFirst({
    where: { name: 'Monrovia Demonstration School' }
  });
  if (!school) {
    school = await prisma.school.create({
      data: { name: 'Monrovia Demonstration School', timezone: 'Africa/Monrovia' }
    });
  }

  let cls = await prisma.class.findFirst({
    where: { name: 'JSS-7A Algebra', teacherId: teacherUser.id }
  });
  if (!cls) {
    cls = await prisma.class.create({
      data: { name: 'JSS-7A Algebra', subject: 'MATH', schoolId: school.id, teacherId: teacherUser.id }
    });
  }

  await prisma.enrollment.upsert({
    where: { studentId_classId: { studentId: student.id, classId: cls.id } },
    update: {},
    create: { studentId: student.id, classId: cls.id }
  });

  console.log(' Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });