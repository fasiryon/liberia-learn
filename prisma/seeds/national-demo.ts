import { PrismaClient, type Subject } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();
const DEMO_PASS = "DemoSeed2026!";

type SchoolPlan = {
  id: string;
  name: string;
  county: string;
  code: string;
  studentCount: number;
  grades: number[];
};

const SCHOOLS: SchoolPlan[] = [
  {
    id: "national-demo-monrovia-central",
    name: "Monrovia Central School",
    county: "Montserrado",
    code: "LIB-MTD-0001",
    studentCount: 25,
    grades: [7, 8, 9, 10],
  },
  {
    id: "national-demo-nimba-academy",
    name: "Nimba County Academy",
    county: "Nimba",
    code: "LIB-NIM-0001",
    studentCount: 20,
    grades: [8, 9, 10, 11],
  },
  {
    id: "national-demo-bong-community",
    name: "Bong Community School",
    county: "Bong",
    code: "LIB-BON-0001",
    studentCount: 15,
    grades: [9, 10, 11, 12],
  },
];

const FIRST_NAMES = [
  "Fatu",
  "Musu",
  "Satta",
  "Korto",
  "Aminata",
  "Joseph",
  "Emmanuel",
  "Moses",
  "Samuel",
  "Hawa",
  "Miatta",
  "Jallah",
  "Mamadee",
  "Tenneh",
  "Varney",
];
const LAST_NAMES = ["Kollie", "Kamara", "Johnson", "Massaquoi", "Sherman", "Toe", "Kpoto", "Dolo", "Saye", "Konneh"];
const SUBJECTS: Subject[] = ["MATH", "SCIENCE", "LITERACY"];

function daysAgo(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value;
}

function daysFromNow(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function stableCode(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8).toUpperCase();
}

function scoreFor(studentIndex: number, attemptIndex: number) {
  const raw = 45 + ((studentIndex * 11 + attemptIndex * 7) % 51);
  return Math.max(45, Math.min(95, raw));
}

function subjectForContent(subject: string): Subject {
  const normalized = subject.toLowerCase();
  if (normalized.includes("math")) return "MATH";
  if (normalized.includes("english") || normalized.includes("literacy") || normalized.includes("language")) return "LITERACY";
  return "SCIENCE";
}

async function ensureApprovedLessons() {
  const lessons = await prisma.curriculumContent.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { createdAt: "asc" }],
    select: { contentId: true, title: true, grade: true, subject: true },
    take: 200,
  });
  if (lessons.length === 0) {
    throw new Error("No APPROVED CurriculumContent rows found. National demo seed requires real approved lesson IDs.");
  }
  return lessons;
}

async function ensureStrand(subject: Subject, grade: number) {
  const band = grade <= 9 ? "G7_9" : "G10_12";
  const existing = await prisma.strandCatalog.findFirst({
    where: { subject, gradeBand: band as any, isActive: true },
    select: { strandKey: true },
  });
  if (existing) return existing.strandKey;

  const strandKey = `national-demo-${subject.toLowerCase()}-${band.toLowerCase()}`;
  await prisma.strandCatalog.upsert({
    where: { subject_strandKey: { subject, strandKey } },
    create: {
      subject,
      strandKey,
      name: "National Demo Mastery",
      gradeBand: band as any,
      isActive: true,
    },
    update: { isActive: true },
  });
  return strandKey;
}

async function seedSchool(plan: SchoolPlan, lessons: Awaited<ReturnType<typeof ensureApprovedLessons>>, passwordHash: string) {
  console.log(`[national-demo] Seeding ${plan.name}...`);
  const school = await prisma.school.upsert({
    where: { code: plan.code },
    create: {
      id: plan.id,
      name: plan.name,
      county: plan.county,
      district: `${plan.county} District`,
      code: plan.code,
      status: "ACTIVE",
      schoolType: "Public",
      approvedAt: daysAgo(60),
      contactEmail: `principal@${plan.code.toLowerCase()}.edu.lr`,
      contactName: `${plan.name} Principal`,
    },
    update: {
      name: plan.name,
      county: plan.county,
      district: `${plan.county} District`,
      status: "ACTIVE",
      schoolType: "Public",
      approvedAt: daysAgo(60),
    },
  });

  const teachers = await Promise.all(
    [0, 1].map(async (index) => {
      const teacher = await prisma.user.upsert({
        where: { email: `teacher${index + 1}@${plan.code.toLowerCase()}.edu.lr` },
        create: {
          id: `${plan.id}-teacher-${index + 1}`,
          email: `teacher${index + 1}@${plan.code.toLowerCase()}.edu.lr`,
          loginId: `${plan.code}-T${index + 1}`,
          name: index === 0 ? "Mary Pewee" : "James Kromah",
          role: "TEACHER",
          hashedPwd: passwordHash,
          schoolId: school.id,
        },
        update: { hashedPwd: passwordHash, schoolId: school.id, role: "TEACHER" },
      });

      await prisma.teacherProfile.upsert({
        where: { userId: teacher.id },
        create: {
          id: `${teacher.id}-profile`,
          userId: teacher.id,
          schoolId: school.id,
          fullName: teacher.name ?? `Teacher ${index + 1}`,
          permissions: { active: true, subjectSpecialty: index === 0 ? "Mathematics" : "Science" },
          gradesTaught: ["G7_9", "G10_12"],
          subjectsTaught: index === 0 ? ["MATH"] : ["SCIENCE"],
          isOnboarded: true,
          updatedAt: new Date(),
        },
        update: { schoolId: school.id, isOnboarded: true, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          id: `${teacher.id}-weekly-report-viewed`,
          userId: teacher.id,
          schoolId: school.id,
          action: "teacher.weekly_report.viewed",
          resourceType: "weekly_report",
          resourceId: `${school.id}-week-${index + 1}`,
          createdAt: daysAgo(7 - index),
          details: { source: "national-demo" },
        },
      }).catch(() => null);

      return teacher;
    })
  );
  console.log(`[national-demo] ${plan.name}: teachers ready.`);

  const classes = await Promise.all(
    plan.grades.map(async (grade, index) => {
      const subject = SUBJECTS[index % SUBJECTS.length];
      const teacher = teachers[index % teachers.length];
      return prisma.class.upsert({
        where: { id: `${plan.id}-grade-${grade}` },
        create: {
          id: `${plan.id}-grade-${grade}`,
          schoolId: school.id,
          name: `Grade ${grade} ${subject.replace(/_/g, " ")}`,
          subject,
          gradeLevel: grade,
          teacherId: teacher.id,
        },
        update: { teacherId: teacher.id, subject, gradeLevel: grade },
      });
    })
  );
  console.log(`[national-demo] ${plan.name}: classes ready.`);

  for (const teacher of teachers) {
    for (let index = 0; index < 4; index += 1) {
      const classroom = classes[(index + teachers.indexOf(teacher)) % classes.length];
      await prisma.assignment.upsert({
        where: { id: `${teacher.id}-assignment-${index + 1}` },
        create: {
          id: `${teacher.id}-assignment-${index + 1}`,
          classId: classroom.id,
          title: `Week ${index + 1} practice assignment`,
          description: "National demo assignment with realistic due date.",
          dueAt: daysFromNow(index + 2),
          points: 100,
          generationMethod: "manual",
        },
        update: {
          classId: classroom.id,
          dueAt: daysFromNow(index + 2),
          generationMethod: "manual",
        },
      });
    }
  }
  console.log(`[national-demo] ${plan.name}: assignments ready.`);

  const scheduledWorkByGrade = new Map<number, string[]>();
  for (const grade of plan.grades) {
    const gradeClass = classes.find((classroom) => classroom.gradeLevel === grade) ?? classes[0];
    const gradeLessons = lessons.filter((lesson) => lesson.grade === grade);
    const fallbackLessons = gradeLessons.length > 0 ? gradeLessons : lessons;
    const scheduledIds: string[] = [];
    for (let index = 0; index < Math.min(18, fallbackLessons.length); index += 1) {
      const lesson = fallbackLessons[index % fallbackLessons.length];
      const id = `${plan.id}-sw-g${grade}-${index + 1}`;
      await prisma.scheduledWork.upsert({
        where: { id },
        create: {
          id,
          contentId: lesson.contentId,
          classId: gradeClass.id,
          scheduledDate: daysAgo(28 - (index % 28)),
          createdById: teachers[index % teachers.length].id,
          isDelivered: true,
          deliveredAt: daysAgo(27 - (index % 27)),
          completionRate: 70 + (index % 25),
          status: "confirmed",
          classFormat: "standard",
        },
        update: {
          contentId: lesson.contentId,
          classId: gradeClass.id,
          isDelivered: true,
          deliveredAt: daysAgo(27 - (index % 27)),
          completionRate: 70 + (index % 25),
        },
      });
      scheduledIds.push(id);
    }
    scheduledWorkByGrade.set(grade, scheduledIds);
  }
  console.log(`[national-demo] ${plan.name}: scheduled work ready.`);

  const progressRows: any[] = [];
  const attemptRows: any[] = [];
  const certificateRows: any[] = [];
  const masteryRows: any[] = [];
  const derivedRows: any[] = [];

  for (let index = 0; index < plan.studentCount; index += 1) {
    const grade = plan.grades[index % plan.grades.length];
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(index + plan.grades.length) % LAST_NAMES.length];
    const user = await prisma.user.upsert({
      where: { email: `student${String(index + 1).padStart(2, "0")}@${plan.code.toLowerCase()}.edu.lr` },
      create: {
        id: `${plan.id}-student-user-${index + 1}`,
        email: `student${String(index + 1).padStart(2, "0")}@${plan.code.toLowerCase()}.edu.lr`,
        loginId: `${plan.code}-S${String(index + 1).padStart(4, "0")}`,
        name: `${firstName} ${lastName}`,
        role: "STUDENT",
        hashedPwd: passwordHash,
        schoolId: school.id,
        createdAt: daysAgo(45 - (index % 8)),
        welcomeCompletedAt: daysAgo(30 - (index % 10)),
      },
      update: { hashedPwd: passwordHash, schoolId: school.id, role: "STUDENT" },
    });

    const student = await prisma.student.upsert({
      where: { userId: user.id },
      create: {
        id: `${plan.id}-student-${index + 1}`,
        userId: user.id,
        currentGrade: grade,
        county: plan.county,
        community: `${plan.county} Community`,
        dateOfBirth: new Date(Date.UTC(2010 - (grade - 7), index % 12, (index % 25) + 1)),
      },
      update: {
        currentGrade: grade,
        county: plan.county,
        community: `${plan.county} Community`,
      },
    });

    const classroom = classes.find((item) => item.gradeLevel === grade) ?? classes[0];
    await prisma.enrollment.upsert({
      where: { studentId_classId: { studentId: student.id, classId: classroom.id } },
      create: { studentId: student.id, classId: classroom.id },
      update: {},
    });

    const completedCount = 8 + (index % 8);
    const workIds = scheduledWorkByGrade.get(grade) ?? [];
    for (let completionIndex = 0; completionIndex < Math.min(completedCount, workIds.length); completionIndex += 1) {
      const scheduledWorkId = workIds[completionIndex];
      progressRows.push({
        id: `${student.id}-progress-${completionIndex + 1}`,
        studentId: user.id,
        scheduledWorkId,
        startedAt: daysAgo(28 - completionIndex),
        completedAt: daysAgo(27 - completionIndex),
        exitTicketScore: 65 + ((index + completionIndex) % 35),
        exitTicketResponses: { source: "national-demo", currentStreakDays: 2 + (index % 4) },
      });
    }

    const attempts = 5 + (index % 6);
    for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
      const lesson = lessons[(index + attemptIndex) % lessons.length];
      const score = scoreFor(index, attemptIndex);
      attemptRows.push({
        id: `${student.id}-quiz-${attemptIndex + 1}`,
        studentId: student.id,
        userId: user.id,
        schoolId: school.id,
        classId: classroom.id,
        subject: lesson.subject,
        grade,
        score,
        maxScore: 100,
        source: "national-demo",
        assessmentId: lesson.contentId,
        assessmentItemId: `${lesson.contentId}:quiz`,
        attemptedAt: daysAgo(26 - (attemptIndex % 26)),
        submittedAt: daysAgo(26 - (attemptIndex % 26)),
        metadata: { distribution: "realistic", percentage: score },
      });
    }

    const certificateCount = 1 + (index % 3);
    for (let certIndex = 0; certIndex < certificateCount; certIndex += 1) {
      const lesson = lessons[(index + certIndex) % lessons.length];
      certificateRows.push({
        id: `${student.id}-certificate-${certIndex + 1}`,
        studentId: student.id,
        type: "LESSON",
        referenceId: lesson.contentId,
        certificateCode: stableCode(`${student.id}:${lesson.contentId}:${certIndex}`),
        awardedAt: daysAgo(20 - certIndex),
      });
    }

    const masterySubject = subjectForContent(lessons[index % lessons.length].subject);
    const strandKey = await ensureStrand(masterySubject, grade);
    const currentScore = 0.58 + ((index % 35) / 100);
    masteryRows.push({
      id: `${student.id}-mastery-${masterySubject}-${strandKey}`,
      studentId: student.id,
      subject: masterySubject,
      strandKey,
      baselineScore: Math.max(0.35, currentScore - 0.14),
      currentScore,
      proficiencyState: currentScore >= 0.75 ? "PROFICIENT" : "APPROACHING",
      masteryState: currentScore >= 0.85 ? "MASTERED" : "APPROACHING",
      sustainabilityIndex: 0.65 + ((index % 20) / 100),
      decayRate: 0.02,
      aiRelianceRate: 0.18,
      lastAssessedAt: daysAgo(index % 20),
    });

    derivedRows.push({
      id: `${student.id}-derived-demo`,
      studentId: student.id,
      schoolId: school.id,
      subject: masterySubject,
      strandKey,
      derivationType: "national_demo_streak",
      currentScore,
      baselineScore: Math.max(0.35, currentScore - 0.14),
      growthDelta: 0.14,
      metadata: { currentStreakDays: 2 + (index % 4), source: "national-demo" },
      derivedAt: daysAgo(index % 25),
    });

    if (index < Math.ceil(plan.studentCount * 0.3)) {
      const guardian = await prisma.user.upsert({
        where: { email: `guardian${String(index + 1).padStart(2, "0")}@${plan.code.toLowerCase()}.family.lr` },
        create: {
          id: `${plan.id}-guardian-${index + 1}`,
          email: `guardian${String(index + 1).padStart(2, "0")}@${plan.code.toLowerCase()}.family.lr`,
          loginId: `${plan.code}-G${String(index + 1).padStart(4, "0")}`,
          name: `${FIRST_NAMES[(index + 3) % FIRST_NAMES.length]} ${lastName}`,
          role: "GUARDIAN",
          hashedPwd: passwordHash,
          schoolId: school.id,
          guardianPhone: `0771${String(index + 1).padStart(6, "0")}`,
          guardianPhoneE164: `+231771${String(index + 1).padStart(6, "0")}`,
          preferredChannel: "SMS",
          smsOptIn: true,
        },
        update: { hashedPwd: passwordHash, schoolId: school.id },
      });
      await prisma.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
        create: { studentId: student.id, guardianId: guardian.id, relation: "Parent" },
        update: { relation: "Parent" },
      });
    }
  }
  console.log(`[national-demo] ${plan.name}: identities and guardian links ready.`);

  await prisma.studentProgress.createMany({ data: progressRows, skipDuplicates: true });
  await prisma.assessmentAttempt.createMany({ data: attemptRows, skipDuplicates: true });
  await prisma.certificate.createMany({ data: certificateRows, skipDuplicates: true });
  await prisma.studentMasteryProfile.createMany({ data: masteryRows, skipDuplicates: true });
  await prisma.derivedStudentProgress.createMany({ data: derivedRows, skipDuplicates: true });

  console.log(`[national-demo] Seeded ${plan.name}: ${plan.studentCount} students, 2 teachers.`);
}

async function seedSchoolFast(plan: SchoolPlan, lessons: Awaited<ReturnType<typeof ensureApprovedLessons>>, passwordHash: string) {
  console.log(`[national-demo] Seeding ${plan.name}...`);
  const school = await prisma.school.upsert({
    where: { code: plan.code },
    create: {
      id: plan.id,
      name: plan.name,
      county: plan.county,
      district: `${plan.county} District`,
      code: plan.code,
      status: "ACTIVE",
      schoolType: "Public",
      approvedAt: daysAgo(60),
      contactEmail: `principal@${plan.code.toLowerCase()}.edu.lr`,
      contactName: `${plan.name} Principal`,
    },
    update: {
      name: plan.name,
      county: plan.county,
      district: `${plan.county} District`,
      status: "ACTIVE",
      schoolType: "Public",
      approvedAt: daysAgo(60),
    },
  });

  const teacherRows = [0, 1].map((index) => ({
    id: `${plan.id}-teacher-${index + 1}`,
    email: `teacher${index + 1}@${plan.code.toLowerCase()}.edu.lr`,
    loginId: `${plan.code}-T${index + 1}`,
    name: index === 0 ? "Mary Pewee" : "James Kromah",
    role: "TEACHER" as const,
    hashedPwd: passwordHash,
    schoolId: school.id,
  }));
  await prisma.user.createMany({ data: teacherRows, skipDuplicates: true });
  await prisma.teacherProfile.createMany({
    data: teacherRows.map((teacher, index) => ({
      id: `${teacher.id}-profile`,
      userId: teacher.id,
      schoolId: school.id,
      fullName: teacher.name,
      permissions: { active: true, subjectSpecialty: index === 0 ? "Mathematics" : "Science" },
      gradesTaught: ["G7_9", "G10_12"],
      subjectsTaught: index === 0 ? ["MATH"] : ["SCIENCE"],
      isOnboarded: true,
      updatedAt: new Date(),
    })),
    skipDuplicates: true,
  });
  await prisma.auditLog.createMany({
    data: teacherRows.map((teacher, index) => ({
      id: `${teacher.id}-weekly-report-viewed`,
      userId: teacher.id,
      schoolId: school.id,
      action: "teacher.weekly_report.viewed",
      resourceType: "weekly_report",
      resourceId: `${school.id}-week-${index + 1}`,
      createdAt: daysAgo(7 - index),
      details: { source: "national-demo" },
    })),
    skipDuplicates: true,
  });

  const classRows = plan.grades.map((grade, index) => ({
    id: `${plan.id}-grade-${grade}`,
    schoolId: school.id,
    name: `Grade ${grade} ${SUBJECTS[index % SUBJECTS.length].replace(/_/g, " ")}`,
    subject: SUBJECTS[index % SUBJECTS.length],
    gradeLevel: grade,
    teacherId: teacherRows[index % teacherRows.length].id,
  }));
  await prisma.class.createMany({ data: classRows, skipDuplicates: true });

  const assignmentRows = teacherRows.flatMap((teacher, teacherIndex) =>
    Array.from({ length: 4 }, (_, index) => {
      const classroom = classRows[(index + teacherIndex) % classRows.length];
      return {
        id: `${teacher.id}-assignment-${index + 1}`,
        classId: classroom.id,
        title: `Week ${index + 1} practice assignment`,
        description: "National demo assignment with realistic due date.",
        dueAt: daysFromNow(index + 2),
        points: 100,
        generationMethod: "manual",
      };
    })
  );
  await prisma.assignment.createMany({ data: assignmentRows, skipDuplicates: true });

  const scheduledRows: any[] = [];
  const scheduledWorkByGrade = new Map<number, string[]>();
  for (const grade of plan.grades) {
    const gradeClass = classRows.find((classroom) => classroom.gradeLevel === grade) ?? classRows[0];
    const gradeLessons = lessons.filter((lesson) => lesson.grade === grade);
    const fallbackLessons = gradeLessons.length > 0 ? gradeLessons : lessons;
    const ids: string[] = [];
    for (let index = 0; index < Math.min(18, fallbackLessons.length); index += 1) {
      const lesson = fallbackLessons[index % fallbackLessons.length];
      const id = `${plan.id}-sw-g${grade}-${index + 1}`;
      ids.push(id);
      scheduledRows.push({
        id,
        contentId: lesson.contentId,
        classId: gradeClass.id,
        scheduledDate: daysAgo(28 - (index % 28)),
        createdById: teacherRows[index % teacherRows.length].id,
        isDelivered: true,
        deliveredAt: daysAgo(27 - (index % 27)),
        completionRate: 70 + (index % 25),
        status: "confirmed",
        classFormat: "standard",
      });
    }
    scheduledWorkByGrade.set(grade, ids);
  }
  await prisma.scheduledWork.createMany({ data: scheduledRows, skipDuplicates: true });

  const studentUserRows = Array.from({ length: plan.studentCount }, (_, index) => {
    const grade = plan.grades[index % plan.grades.length];
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(index + plan.grades.length) % LAST_NAMES.length];
    return {
      id: `${plan.id}-student-user-${index + 1}`,
      email: `student${String(index + 1).padStart(2, "0")}@${plan.code.toLowerCase()}.edu.lr`,
      loginId: `${plan.code}-S${String(index + 1).padStart(4, "0")}`,
      name: `${firstName} ${lastName}`,
      role: "STUDENT" as const,
      hashedPwd: passwordHash,
      schoolId: school.id,
      createdAt: daysAgo(45 - (index % 8)),
      welcomeCompletedAt: daysAgo(30 - (index % 10)),
      grade,
      firstName,
      lastName,
      index,
    };
  });
  await prisma.user.createMany({
    data: studentUserRows.map(({ grade: _grade, firstName: _firstName, lastName: _lastName, index: _index, ...row }) => row),
    skipDuplicates: true,
  });

  const studentRows = studentUserRows.map((row) => ({
    id: `${plan.id}-student-${row.index + 1}`,
    userId: row.id,
    currentGrade: row.grade,
    county: plan.county,
    community: `${plan.county} Community`,
    dateOfBirth: new Date(Date.UTC(2010 - (row.grade - 7), row.index % 12, (row.index % 25) + 1)),
  }));
  await prisma.student.createMany({ data: studentRows, skipDuplicates: true });

  await prisma.enrollment.createMany({
    data: studentRows.map((student) => {
      const classroom = classRows.find((item) => item.gradeLevel === student.currentGrade) ?? classRows[0];
      return { studentId: student.id, classId: classroom.id };
    }),
    skipDuplicates: true,
  });

  const guardianCount = Math.ceil(plan.studentCount * 0.3);
  const guardianRows = studentUserRows.slice(0, guardianCount).map((row) => ({
    id: `${plan.id}-guardian-${row.index + 1}`,
    email: `guardian${String(row.index + 1).padStart(2, "0")}@${plan.code.toLowerCase()}.family.lr`,
    loginId: `${plan.code}-G${String(row.index + 1).padStart(4, "0")}`,
    name: `${FIRST_NAMES[(row.index + 3) % FIRST_NAMES.length]} ${row.lastName}`,
    role: "GUARDIAN" as const,
    hashedPwd: passwordHash,
    schoolId: school.id,
    guardianPhone: `0771${String(row.index + 1).padStart(6, "0")}`,
    guardianPhoneE164: `+231771${String(row.index + 1).padStart(6, "0")}`,
    preferredChannel: "SMS",
    smsOptIn: true,
  }));
  await prisma.user.createMany({ data: guardianRows, skipDuplicates: true });
  await prisma.studentGuardian.createMany({
    data: guardianRows.map((guardian, index) => ({
      studentId: studentRows[index].id,
      guardianId: guardian.id,
      relation: "Parent",
    })),
    skipDuplicates: true,
  });

  const strandCache = new Map<string, string>();
  const progressRows: any[] = [];
  const attemptRows: any[] = [];
  const certificateRows: any[] = [];
  const masteryRows: any[] = [];
  const derivedRows: any[] = [];

  for (const row of studentUserRows) {
    const student = studentRows[row.index];
    const classroom = classRows.find((item) => item.gradeLevel === row.grade) ?? classRows[0];
    const workIds = scheduledWorkByGrade.get(row.grade) ?? [];
    const completedCount = 8 + (row.index % 8);
    for (let completionIndex = 0; completionIndex < Math.min(completedCount, workIds.length); completionIndex += 1) {
      progressRows.push({
        id: `${student.id}-progress-${completionIndex + 1}`,
        studentId: row.id,
        scheduledWorkId: workIds[completionIndex],
        startedAt: daysAgo(28 - completionIndex),
        completedAt: daysAgo(27 - completionIndex),
        exitTicketScore: 65 + ((row.index + completionIndex) % 35),
        exitTicketResponses: { source: "national-demo", currentStreakDays: 2 + (row.index % 4) },
      });
    }

    const attempts = 5 + (row.index % 6);
    for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
      const lesson = lessons[(row.index + attemptIndex) % lessons.length];
      const score = scoreFor(row.index, attemptIndex);
      attemptRows.push({
        id: `${student.id}-quiz-${attemptIndex + 1}`,
        studentId: student.id,
        userId: row.id,
        schoolId: school.id,
        classId: classroom.id,
        subject: lesson.subject,
        grade: row.grade,
        score,
        maxScore: 100,
        source: "national-demo",
        assessmentId: lesson.contentId,
        assessmentItemId: `${lesson.contentId}:quiz`,
        attemptedAt: daysAgo(26 - (attemptIndex % 26)),
        submittedAt: daysAgo(26 - (attemptIndex % 26)),
        metadata: { distribution: "realistic", percentage: score },
      });
    }

    for (let certIndex = 0; certIndex < 1 + (row.index % 3); certIndex += 1) {
      const lesson = lessons[(row.index + certIndex) % lessons.length];
      certificateRows.push({
        id: `${student.id}-certificate-${certIndex + 1}`,
        studentId: student.id,
        type: "LESSON",
        referenceId: lesson.contentId,
        certificateCode: stableCode(`${student.id}:${lesson.contentId}:${certIndex}`),
        awardedAt: daysAgo(20 - certIndex),
      });
    }

    const masterySubject = subjectForContent(lessons[row.index % lessons.length].subject);
    const cacheKey = `${masterySubject}:${row.grade}`;
    let strandKey = strandCache.get(cacheKey);
    if (!strandKey) {
      strandKey = await ensureStrand(masterySubject, row.grade);
      strandCache.set(cacheKey, strandKey);
    }
    const currentScore = 0.58 + ((row.index % 35) / 100);
    masteryRows.push({
      id: `${student.id}-mastery-${masterySubject}-${strandKey}`,
      studentId: student.id,
      subject: masterySubject,
      strandKey,
      baselineScore: Math.max(0.35, currentScore - 0.14),
      currentScore,
      proficiencyState: currentScore >= 0.75 ? "PROFICIENT" : "APPROACHING",
      masteryState: currentScore >= 0.85 ? "MASTERED" : "APPROACHING",
      sustainabilityIndex: 0.65 + ((row.index % 20) / 100),
      decayRate: 0.02,
      aiRelianceRate: 0.18,
      lastAssessedAt: daysAgo(row.index % 20),
    });
    derivedRows.push({
      id: `${student.id}-derived-demo`,
      studentId: student.id,
      schoolId: school.id,
      subject: masterySubject,
      strandKey,
      derivationType: "national_demo_streak",
      currentScore,
      baselineScore: Math.max(0.35, currentScore - 0.14),
      growthDelta: 0.14,
      metadata: { currentStreakDays: 2 + (row.index % 4), source: "national-demo" },
      derivedAt: daysAgo(row.index % 25),
    });
  }

  await prisma.studentProgress.createMany({ data: progressRows, skipDuplicates: true });
  await prisma.assessmentAttempt.createMany({ data: attemptRows, skipDuplicates: true });
  await prisma.certificate.createMany({ data: certificateRows, skipDuplicates: true });
  await prisma.studentMasteryProfile.createMany({ data: masteryRows, skipDuplicates: true });
  await prisma.derivedStudentProgress.createMany({ data: derivedRows, skipDuplicates: true });

  console.log(`[national-demo] Seeded ${plan.name}: ${plan.studentCount} students, 2 teachers.`);
}

async function main() {
  const [passwordHash, lessons] = await Promise.all([bcrypt.hash(DEMO_PASS, 10), ensureApprovedLessons()]);
  for (const school of SCHOOLS) {
    await seedSchoolFast(school, lessons, passwordHash);
  }
  console.log("[national-demo] Complete. Schools: 3. Students: 60. Counties: Montserrado, Nimba, Bong.");
}

main()
  .catch((error) => {
    console.error("[national-demo] Failed", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
