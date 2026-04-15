// prisma/seeds/cha-demo.ts
// CHA High Academy demo accounts for MOE pilot demonstrations.
// Idempotent â€” safe to re-run. Uses upsert everywhere.
// Accounts match the official demo handout exactly.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASS = "DemoSeed2026!";
const MOE_PASS = "MOESeed2026!";

const CHA_SCHOOL_ID = "cha-high-academy";
const CHA_CLASS_ID = "cha-class-grade9a";
const CHA_CONTENT_FRACTIONS_ID = "cha-content-fractions";
const CHA_CONTENT_EQUATIONS_ID = "cha-content-equations";
const CHA_ASSIGNMENT_ID = "cha-assignment-fractions";
const CHA_HOMEWORK_ID = "cha-homework-fractions";

async function seedChaDemoActivity(params: {
  schoolId: string;
  classId: string;
  teacherId: string;
  studentId: string;
  studentUserId: string;
}) {
  const { schoolId, classId, teacherId, studentId, studentUserId } = params;
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const laterThisWeek = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  await prisma.curriculumContent.upsert({
    where: { contentId: CHA_CONTENT_FRACTIONS_ID },
    update: {
      payload: {
        title: "Fractions in Everyday Markets",
        topic: "Fractions",
        body: "Use simple fractions to compare rice bags and market prices.",
        durationMins: 45,
      } as any,
    },
    create: {
      contentId: CHA_CONTENT_FRACTIONS_ID,
      grade: 9,
      subject: "MATH",
      contentType: "lesson",
      status: "APPROVED",
      version: "1.0",
      payload: {
        title: "Fractions in Everyday Markets",
        topic: "Fractions",
        body: "Use simple fractions to compare rice bags and market prices.",
        durationMins: 45,
      } as any,
    },
  });

  await prisma.curriculumContent.upsert({
    where: { contentId: CHA_CONTENT_EQUATIONS_ID },
    update: {
      payload: {
        title: "Balancing Simple Equations",
        topic: "Equations",
        body: "Practice balancing equations using market trading examples.",
        durationMins: 45,
      } as any,
    },
    create: {
      contentId: CHA_CONTENT_EQUATIONS_ID,
      grade: 9,
      subject: "MATH",
      contentType: "lesson",
      status: "APPROVED",
      version: "1.0",
      payload: {
        title: "Balancing Simple Equations",
        topic: "Equations",
        body: "Practice balancing equations using market trading examples.",
        durationMins: 45,
      } as any,
    },
  });

  await prisma.scheduledWork.upsert({
    where: { id: "cha-sw-yesterday" },
    update: {
      scheduledDate: yesterday,
      isDelivered: true,
      deliveredAt: yesterday,
      status: "confirmed",
      completionRate: 100,
    },
    create: {
      id: "cha-sw-yesterday",
      contentId: CHA_CONTENT_FRACTIONS_ID,
      classId,
      scheduledDate: yesterday,
      createdById: teacherId,
      isDelivered: true,
      deliveredAt: yesterday,
      status: "confirmed",
      completionRate: 100,
      periodNumber: 1,
      startTime: "09:00",
      endTime: "09:45",
    },
  });

  await prisma.scheduledWork.upsert({
    where: { id: "cha-sw-today" },
    update: {
      scheduledDate: now,
      isDelivered: true,
      deliveredAt: now,
      status: "confirmed",
      completionRate: 100,
    },
    create: {
      id: "cha-sw-today",
      contentId: CHA_CONTENT_EQUATIONS_ID,
      classId,
      scheduledDate: now,
      createdById: teacherId,
      isDelivered: true,
      deliveredAt: now,
      status: "confirmed",
      completionRate: 100,
      periodNumber: 2,
      startTime: "11:00",
      endTime: "11:45",
    },
  });

  await prisma.studentProgress.upsert({
    where: {
      studentId_scheduledWorkId: {
        studentId: studentUserId,
        scheduledWorkId: "cha-sw-yesterday",
      },
    },
    update: {
      startedAt: yesterday,
      completedAt: yesterday,
      exitTicketScore: 4,
    },
    create: {
      studentId: studentUserId,
      scheduledWorkId: "cha-sw-yesterday",
      startedAt: yesterday,
      completedAt: yesterday,
      exitTicketScore: 4,
    },
  });

  await prisma.studentProgress.upsert({
    where: {
      studentId_scheduledWorkId: {
        studentId: studentUserId,
        scheduledWorkId: "cha-sw-today",
      },
    },
    update: {
      startedAt: now,
      completedAt: now,
      exitTicketScore: 5,
    },
    create: {
      studentId: studentUserId,
      scheduledWorkId: "cha-sw-today",
      startedAt: now,
      completedAt: now,
      exitTicketScore: 5,
    },
  });

  await prisma.meeting.upsert({
    where: { id: "cha-meeting-today" },
    update: {
      startsAt: now,
      endsAt: new Date(now.getTime() + 45 * 60 * 1000),
    },
    create: {
      id: "cha-meeting-today",
      classId,
      startsAt: now,
      endsAt: new Date(now.getTime() + 45 * 60 * 1000),
    },
  });

  await prisma.attendanceRecord.upsert({
    where: {
      meetingId_studentId: {
        meetingId: "cha-meeting-today",
        studentId,
      },
    },
    update: {
      status: "PRESENT",
      markedAt: now,
    },
    create: {
      id: "cha-attendance-today",
      meetingId: "cha-meeting-today",
      studentId,
      status: "PRESENT",
      markedAt: now,
    },
  });

  await prisma.studentMasteryProfile.upsert({
    where: {
      StudentMasteryProfile_studentId_subject_strandKey_key: {
        studentId,
        subject: "MATH",
        strandKey: "ALGEBRA.LINEAR",
      },
    },
    update: {
      baselineScore: 0.58,
      currentScore: 0.74,
      masteryState: "APPROACHING",
      proficiencyState: "PROFICIENT",
      sustainabilityIndex: 0.82,
    },
    create: {
      studentId,
      subject: "MATH",
      strandKey: "ALGEBRA.LINEAR",
      baselineScore: 0.58,
      currentScore: 0.74,
      masteryState: "APPROACHING",
      proficiencyState: "PROFICIENT",
      sustainabilityIndex: 0.82,
    },
  });

  await prisma.studentMasteryProfile.upsert({
    where: {
      StudentMasteryProfile_studentId_subject_strandKey_key: {
        studentId,
        subject: "MATH",
        strandKey: "NUMBER.FRACTIONS",
      },
    },
    update: {
      baselineScore: 0.44,
      currentScore: 0.63,
      masteryState: "DEVELOPING",
      proficiencyState: "APPROACHING",
      sustainabilityIndex: 0.71,
    },
    create: {
      studentId,
      subject: "MATH",
      strandKey: "NUMBER.FRACTIONS",
      baselineScore: 0.44,
      currentScore: 0.63,
      masteryState: "DEVELOPING",
      proficiencyState: "APPROACHING",
      sustainabilityIndex: 0.71,
    },
  });

  await prisma.assignment.upsert({
    where: { id: CHA_ASSIGNMENT_ID },
    update: {
      dueAt: laterThisWeek,
      points: 100,
    },
    create: {
      id: CHA_ASSIGNMENT_ID,
      classId,
      title: "Fractions Exit Assignment",
      description: "Apply fractions and ratios to market-price examples.",
      dueAt: laterThisWeek,
      points: 100,
    },
  });

  await prisma.assignmentSubmission.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId: CHA_ASSIGNMENT_ID,
        studentId,
      },
    },
    update: {
      turnedInAt: now,
      content: "Completed with worked examples.",
      score: 88,
      feedback: "Strong reasoning. Recheck unit conversion in the last problem.",
      gradedAt: now,
      gradedBy: teacherId,
    },
    create: {
      assignmentId: CHA_ASSIGNMENT_ID,
      studentId,
      turnedInAt: now,
      content: "Completed with worked examples.",
      score: 88,
      feedback: "Strong reasoning. Recheck unit conversion in the last problem.",
      gradedAt: now,
      gradedBy: teacherId,
    },
  });

  await prisma.homework.upsert({
    where: { id: CHA_HOMEWORK_ID },
    update: {
      dueAt: tomorrow,
      instructions: "Complete the revision set on fractions and ratios.",
    },
    create: {
      id: CHA_HOMEWORK_ID,
      classId,
      title: "Fractions Revision Homework",
      dueAt: tomorrow,
      createdById: teacherId,
      instructions: "Complete the revision set on fractions and ratios.",
      description: "Revision work aligned to this week's lesson.",
    },
  });

  await prisma.homeworkSubmission.upsert({
    where: {
      homeworkId_studentId: {
        homeworkId: CHA_HOMEWORK_ID,
        studentId,
      },
    },
    update: {
      submittedAt: yesterday,
      aiReviewed: true,
      aiScore: 84,
      teacherScore: 86,
      answers: {
        workingShown: true,
      } as any,
      aiFeedback: {
        overall: "Clear work and strong fraction simplification.",
      } as any,
    },
    create: {
      homeworkId: CHA_HOMEWORK_ID,
      studentId,
      submittedAt: yesterday,
      aiReviewed: true,
      aiScore: 84,
      teacherScore: 86,
      answers: {
        workingShown: true,
      } as any,
      aiFeedback: {
        overall: "Clear work and strong fraction simplification.",
      } as any,
    },
  });

  await prisma.grade.upsert({
    where: { id: "cha-grade-math-term" },
    update: {
      percent: 86,
      letter: "B+",
    },
    create: {
      id: "cha-grade-math-term",
      classId,
      studentId,
      percent: 86,
      letter: "B+",
    },
  });

  await prisma.chatMessage.upsert({
    where: { id: "cha-chat-1" },
    update: {
      content: "How do I balance equations with fractions?",
    },
    create: {
      id: "cha-chat-1",
      studentId,
      role: "student",
      content: "How do I balance equations with fractions?",
      agentId: "ai-tutor",
    },
  });

  await prisma.chatMessage.upsert({
    where: { id: "cha-chat-2" },
    update: {
      content: "Start by isolating the variable and checking equivalent values.",
    },
    create: {
      id: "cha-chat-2",
      studentId,
      role: "assistant",
      content: "Start by isolating the variable and checking equivalent values.",
      agentId: "ai-tutor",
    },
  });

  await prisma.auditLog.upsert({
    where: { id: "cha-audit-lesson-view" },
    update: {
      action: "lesson_view",
      schoolId,
      userId: studentUserId,
      resourceType: "scheduled_work",
      resourceId: "cha-sw-today",
      createdAt: now,
    },
    create: {
      id: "cha-audit-lesson-view",
      action: "lesson_view",
      schoolId,
      userId: studentUserId,
      resourceType: "scheduled_work",
      resourceId: "cha-sw-today",
      createdAt: now,
    },
  });

  await prisma.auditLog.upsert({
    where: { id: "cha-audit-teacher-dashboard" },
    update: {
      action: "teacher.dashboard.viewed",
      schoolId,
      userId: teacherId,
      resourceType: "teacher_dashboard",
      resourceId: classId,
      createdAt: now,
    },
    create: {
      id: "cha-audit-teacher-dashboard",
      action: "teacher.dashboard.viewed",
      schoolId,
      userId: teacherId,
      resourceType: "teacher_dashboard",
      resourceId: classId,
      createdAt: now,
    },
  });
}

export async function seedChaDemo() {
  console.log("[cha-demo] Seeding CHA demo accounts...");

  const [demoHash, moeHash] = await Promise.all([
    bcrypt.hash(DEMO_PASS, 10),
    bcrypt.hash(MOE_PASS, 10),
  ]);

  // â”€â”€ School â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const school = await prisma.school.upsert({
    where: { code: "CHA" },
    create: {
      id: CHA_SCHOOL_ID,
      name: "Cha High Academy",
      county: "Montserrado",
      code: "CHA",
    },
    update: {},
  });

  // â”€â”€ Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const admin = await prisma.user.upsert({
    where: { email: "admin@cha.edu.lr" },
    create: {
      email: "admin@cha.edu.lr",
      name: "CHA Administrator",
      role: "ADMIN",
      hashedPwd: demoHash,
      schoolId: school.id,
      isPlatformAdmin: false,
    },
    update: { hashedPwd: demoHash },
  });

  // â”€â”€ Teacher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const teacher = await prisma.user.upsert({
    where: { email: "teacher1@cha.edu.lr" },
    create: {
      email: "teacher1@cha.edu.lr",
      name: "Mary Pewee",
      role: "TEACHER",
      hashedPwd: demoHash,
      schoolId: school.id,
    },
    update: { hashedPwd: demoHash },
  });

  // Teacher profile (upsert by userId)
  await prisma.teacherProfile.upsert({
    where: { userId: teacher.id },
    create: {
      id: `tp_cha_teacher`,
      userId: teacher.id,
      schoolId: school.id,
      fullName: "Mary Pewee",
      permissions: {
        active: true,
        subjectSpecialty: "Mathematics",
        allowPublish: false,
        allowBlueprint: false,
      },
      gradesTaught: ["G7_9"],
      subjectsTaught: ["MATH"],
      isOnboarded: true,
      updatedAt: new Date(),
    },
    update: {},
  }).catch(() => {
    // Profile may already exist â€” skip
  });

  // â”€â”€ Class â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cls = await prisma.class.upsert({
    where: { id: CHA_CLASS_ID },
    create: {
      id: CHA_CLASS_ID,
      name: "Grade 9A â€” Mathematics",
      subject: "MATH",
      schoolId: school.id,
      teacherId: teacher.id,
    },
    update: { teacherId: teacher.id },
  });

  // â”€â”€ Student â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const studentUser = await prisma.user.upsert({
    where: { email: "student1@cha.edu.lr" },
    create: {
      email: "student1@cha.edu.lr",
      loginId: "CHA-2026-0001",
      name: "Fatu Kollie",
      role: "STUDENT",
      hashedPwd: demoHash,
      schoolId: school.id,
    },
    update: { hashedPwd: demoHash },
  });

  let studentRecord = await prisma.student.findUnique({
    where: { userId: studentUser.id },
  });
  if (!studentRecord) {
    studentRecord = await prisma.student.create({
      data: { userId: studentUser.id, currentGrade: 9 },
    });
  }

  // Enrollment (skip if already enrolled)
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: studentRecord.id, classId: cls.id },
  });
  if (!existingEnrollment) {
    await prisma.enrollment.create({
      data: { studentId: studentRecord.id, classId: cls.id },
    });
  }

  // Placement test
  const existingPlacement = await prisma.placementTest.findFirst({
    where: { studentId: studentRecord.id },
  });
  if (!existingPlacement) {
    await prisma.placementTest.create({
      data: {
        studentId: studentRecord.id,
        band: "G7_9",
        levelLabel: "Junior Secondary",
        estimatedGrade: 9,
        rawScore: 14,
        totalQuestions: 18,
        aiAnalysis: {
          summary:
            "Student demonstrates solid understanding of core mathematics concepts for Grade 9.",
          strengths: ["Algebra", "Number Theory"],
          gaps: ["Geometry proofs"],
        },
      },
    });
    await prisma.student.update({
      where: { id: studentRecord.id },
      data: { currentGrade: 9 },
    });
  }

  await seedChaDemoActivity({
    schoolId: school.id,
    classId: cls.id,
    teacherId: teacher.id,
    studentId: studentRecord.id,
    studentUserId: studentUser.id,
  });

  // â”€â”€ Guardian â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const guardian = await prisma.user.upsert({
    where: { email: "guardian1@cha.family.lr" },
    create: {
      email: "guardian1@cha.family.lr",
      name: "Emmanuel Kollie",
      role: "GUARDIAN",
      hashedPwd: demoHash,
      schoolId: school.id,
      guardianPhone: "0771000001",
      guardianPhoneE164: "+2310771000001",
      preferredChannel: "SMS",
    },
    update: { hashedPwd: demoHash },
  });

  // Guardian-student link
  const existingLink = await prisma.studentGuardian.findFirst({
    where: { studentId: studentRecord.id, guardianId: guardian.id },
  });
  if (!existingLink) {
    await prisma.studentGuardian.create({
      data: {
        studentId: studentRecord.id,
        guardianId: guardian.id,
        relation: "Parent",
      },
    });
  }

  // â”€â”€ MOE Official â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.user.upsert({
    where: { email: "official1@moe.gov.lr" },
    create: {
      email: "official1@moe.gov.lr",
      name: "MOE Inspector General",
      role: "MOE_OFFICIAL",
      hashedPwd: moeHash,
      schoolId: null,
      isPlatformAdmin: false,
    },
    update: { hashedPwd: moeHash },
  });

  console.log("[cha-demo] Done. Accounts created:");
  console.log("  admin@cha.edu.lr           / DemoSeed2026! (ADMIN)");
  console.log("  teacher1@cha.edu.lr        / DemoSeed2026! (TEACHER)");
  console.log("  student1@cha.edu.lr        / DemoSeed2026! (STUDENT)");
  console.log("  guardian1@cha.family.lr    / DemoSeed2026! (GUARDIAN)");
  console.log("  official1@moe.gov.lr       / MOESeed2026!  (MOE_OFFICIAL)");
}

// Direct run
if (require.main === module) {
  seedChaDemo()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

