import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({
    where: { code: "CHA" },
    select: { id: true },
  });
  if (!school) {
    console.error("CHA not found");
    return;
  }

  const studentUser = await prisma.user.findFirst({
    where: { email: "student1@cha.edu.lr" },
    select: { id: true },
  });
  const teacherUser = await prisma.user.findFirst({
    where: { email: "teacher1@cha.edu.lr" },
    select: { id: true },
  });

  if (!studentUser || !teacherUser) {
    console.error("Required CHA demo users not found");
    return;
  }

  const student = await prisma.student.findFirst({
    where: { userId: studentUser.id },
    select: { id: true },
  });

  if (!student) {
    console.error("student1@cha.edu.lr student profile not found");
    return;
  }

  const mathLessons = await prisma.curriculumContent.findMany({
    where: {
      grade: 7,
      subject: "MATH",
      status: "APPROVED",
    },
    take: 3,
    select: { contentId: true, title: true },
  });

  const lessons =
    mathLessons.length > 0
      ? mathLessons
      : await prisma.curriculumContent.findMany({
          where: { grade: 7, status: "APPROVED" },
          take: 3,
          select: { contentId: true, title: true },
        });

  if (lessons.length < 1) {
    console.log("No approved Grade 7 lessons found");
    return;
  }

  console.log("Using lessons:", lessons.map((lesson) => lesson.title ?? lesson.contentId));

  const grade7Class = await prisma.class.findFirst({
    where: { schoolId: school.id, gradeLevel: 7 },
    select: { id: true },
  });

  if (!grade7Class) {
    console.error("CHA Grade 7 class not found");
    return;
  }

  const scores = [78, 85, 92];
  let completed = 0;
  let assignmentsCreated = 0;
  let eventsLogged = 0;

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    const scheduledWork = await prisma.scheduledWork.upsert({
      where: {
        id: `vsl-demo-progress-${studentUser.id}-${lesson.contentId}`,
      },
      update: {
        contentId: lesson.contentId,
        classId: grade7Class.id,
        createdById: teacherUser.id,
        scheduledDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        status: "confirmed",
      },
      create: {
        id: `vsl-demo-progress-${studentUser.id}-${lesson.contentId}`,
        contentId: lesson.contentId,
        classId: grade7Class.id,
        createdById: teacherUser.id,
        scheduledDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        status: "confirmed",
      },
    });

    await prisma.studentProgress.upsert({
      where: {
        studentId_scheduledWorkId: {
          studentId: studentUser.id,
          scheduledWorkId: scheduledWork.id,
        },
      },
      update: {
        completedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        exitTicketScore: scores[i],
      },
      create: {
        studentId: studentUser.id,
        scheduledWorkId: scheduledWork.id,
        startedAt: new Date(Date.now() - (i * 24 + 1) * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        exitTicketScore: scores[i],
      },
    });
    completed++;
    console.log(`Seeded progress: ${lesson.title ?? lesson.contentId} ${scores[i]}%`);
  }

  for (const assignment of [
    {
      id: "vsl-demo-assignment-morning-algebra-practice",
      title: "Morning Algebra Practice",
      contentId: lessons[0].contentId,
    },
    {
      id: "vsl-demo-assignment-reading-comprehension-check",
      title: "Reading Comprehension Check",
      contentId: lessons[Math.min(1, lessons.length - 1)].contentId,
    },
  ]) {
    const existing = await prisma.scheduledWork.findUnique({
      where: { id: assignment.id },
      select: { id: true },
    });

    await prisma.scheduledWork.upsert({
      where: { id: assignment.id },
      update: {
        contentId: assignment.contentId,
        classId: grade7Class.id,
        createdById: teacherUser.id,
        scheduledDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
        status: "confirmed",
      },
      create: {
        id: assignment.id,
        contentId: assignment.contentId,
        classId: grade7Class.id,
        createdById: teacherUser.id,
        scheduledDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
        status: "confirmed",
      },
    });

    if (!existing) assignmentsCreated++;
    console.log(`Seeded assignment: ${assignment.title}`);
  }

  const eventTypes = ["LESSON_COMPLETED", "QUIZ_SUBMITTED", "LESSON_COMPLETED"];
  for (let i = 0; i < eventTypes.length; i++) {
    const lesson = lessons[Math.min(i, lessons.length - 1)];
    await prisma.learningEvent.create({
      data: {
        userId: studentUser.id,
        studentId: student.id,
        schoolId: school.id,
        eventType: eventTypes[i],
        source: "vsl_demo_seed",
        contentId: lesson.contentId,
        subject: "MATH",
        grade: 7,
        metadata: {
          score: scores[i],
          source: "vsl_demo_seed",
        },
        occurredAt: new Date(Date.now() - i * 3 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - i * 3 * 60 * 60 * 1000),
      },
    });
    eventsLogged++;
  }

  console.log("Seeded learning events");
  console.log(
    `VSL demo data seeding complete: lessons completed=${completed}, assignments created=${assignmentsCreated}, events logged=${eventsLogged}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
