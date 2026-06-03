import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

function getConfiguredDemoSchoolId() {
  return (process.env.DEMO_SCHOOL_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);
}

export async function POST() {
  try {
    const user = await requireRole("ADMIN");
    const demoSchoolId = getConfiguredDemoSchoolId();

    if (!demoSchoolId) {
      return NextResponse.json(
        { error: "DEMO_SCHOOL_IDS not configured" },
        { status: 400 }
      );
    }

    // Determine schoolId: use session if present, else try DB, else fall back to demo school
    let schoolId: string | null = (user.schoolId as string) ?? null;
    if (!schoolId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { schoolId: true },
      });
      schoolId = dbUser?.schoolId ?? null;
    }
    if (!schoolId) {
      // Auto-attach to demo school if it exists
      const demoSchool = await prisma.school.findUnique({
        where: { id: demoSchoolId },
        select: { id: true },
      });
      if (demoSchool) {
        await prisma.user.update({
          where: { id: user.id },
          data: { schoolId: demoSchoolId },
        });
        schoolId = demoSchoolId;
      }
    }

    if (!schoolId) {
      return NextResponse.json(
        { error: "No schoolId and demo school not found. Run onboarding first." },
        { status: 400 }
      );
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true },
    });
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const logs: string[] = [];
    logs.push(`School: ${school.name} (${school.id})`);

    // Fix null-schoolId demo users (idempotent)
    const nullSchoolEmails = [
      "admin@school.lr",
      "teacher@school.lr",
      "student@school.lr",
      "admin@liberialearn.lr",
    ];
    for (const email of nullSchoolEmails) {
      const u = await prisma.user.findUnique({
        where: { email },
        select: { id: true, schoolId: true },
      });
      if (u && !u.schoolId) {
        await prisma.user.update({
          where: { id: u.id },
          data: { schoolId: school.id },
        });
        logs.push(`Attached ${email} to ${school.name}`);
      }
    }

    // Find teacher in this school
    const teacher = await prisma.user.findFirst({
      where: { schoolId, role: "TEACHER" },
    });
    if (!teacher) {
      return NextResponse.json(
        { error: "No teacher found in this school. Create a teacher first." },
        { status: 400 }
      );
    }
    logs.push(`Teacher: ${teacher.email}`);

    // Find students
    const studentUsers = await prisma.user.findMany({
      where: { schoolId, role: "STUDENT" },
      take: 5,
    });
    logs.push(`Students found: ${studentUsers.length}`);

    // Upsert class
    let cls = await prisma.class.findFirst({
      where: { schoolId, name: "Grade 4 Mathematics" },
    });
    if (!cls) {
      cls = await prisma.class.create({
        data: {
          schoolId,
          name: "Grade 4 Mathematics",
          subject: "MATH",
          teacherId: teacher.id,
        },
      });
      logs.push(`Created class: ${cls.name}`);
    } else {
      if (cls.teacherId !== teacher.id) {
        await prisma.class.update({
          where: { id: cls.id },
          data: { teacherId: teacher.id },
        });
      }
      logs.push(`Class exists: ${cls.name}`);
    }

    // Ensure student profiles + enrollments
    let enrolled = 0;
    for (const su of studentUsers) {
      let student = await prisma.student.findUnique({
        where: { userId: su.id },
      });
      if (!student) {
        student = await prisma.student.create({
          data: {
            userId: su.id,
            county: "Montserrado",
            community: "Monrovia",
            currentGrade: 4,
          },
        });
      }
      const existing = await prisma.enrollment.findFirst({
        where: { studentId: student.id, classId: cls.id },
      });
      if (!existing) {
        await prisma.enrollment.create({
          data: { studentId: student.id, classId: cls.id },
        });
        enrolled++;
      }
    }
    logs.push(`Newly enrolled: ${enrolled}`);

    const defaultHwQuestions = [
      { question: "What is 245 + 378?", type: "FR" },
      { question: "What is 500 - 167?", type: "FR" },
      {
        question:
          "A market woman has 456 Liberian dollars. She spends 189. How much is left?",
        type: "FR",
      },
    ];

    // Create homework if none, or backfill questions if existing homework lacks them
    let hw = await prisma.homework.findFirst({
      where: { classId: cls.id },
      select: { id: true, title: true, questions: true },
    });
    if (!hw) {
      hw = await prisma.homework.create({
        data: {
          classId: cls.id,
          title: "Addition and Subtraction Practice",
          description:
            "Complete 10 addition and subtraction problems. Show your work.",
          createdById: teacher.id,
          instructions:
            "Solve each problem step by step. Write your final answer clearly.",
          questions: defaultHwQuestions,
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      logs.push(`Created homework: ${hw.title}`);
    } else {
      const hasQuestions = Array.isArray(hw.questions) && (hw.questions as any[]).length > 0;
      if (!hasQuestions) {
        await prisma.homework.update({
          where: { id: hw.id },
          data: { questions: defaultHwQuestions },
        });
        logs.push(`Backfilled questions on homework: ${hw.title}`);
      } else {
        logs.push(`Homework exists: ${hw.title}`);
      }
    }

    // Backfill questions on all homework in this school that have none
    const emptyHomework = await prisma.homework.findMany({
      where: { Class: { schoolId } },
      select: { id: true, title: true, questions: true, Class: { select: { subject: true } } },
    });
    let backfilledCount = 0;
    for (const item of emptyHomework) {
      const hasQ = Array.isArray(item.questions) && (item.questions as any[]).length > 0;
      if (!hasQ) {
        const subjectLabel = item.Class?.subject ?? "this subject";
        await prisma.homework.update({
          where: { id: item.id },
          data: {
            questions: [
              `Explain in your own words one key concept you learned in ${subjectLabel} this week.`,
              `Give two real-life examples of how ${subjectLabel} is used in everyday life in Liberia.`,
              `What is one question you still have about ${subjectLabel}? Try to answer it yourself.`,
            ],
          },
        });
        backfilledCount++;
      }
    }
    if (backfilledCount > 0) logs.push(`Backfilled questions on ${backfilledCount} homework record(s)`);

    // Create submission from first student
    if (studentUsers.length > 0) {
      const firstStudent = await prisma.student.findUnique({
        where: { userId: studentUsers[0].id },
      });
      if (firstStudent) {
        const existingSub = await prisma.homeworkSubmission.findFirst({
          where: { homeworkId: hw.id, studentId: firstStudent.id },
        });
        if (!existingSub) {
          await prisma.homeworkSubmission.create({
            data: {
              homeworkId: hw.id,
              studentId: firstStudent.id,
              answers: [
                { questionIndex: 0, answer: "623" },
                { questionIndex: 1, answer: "333" },
                { questionIndex: 2, answer: "267" },
              ],
              aiScore: 85,
              aiFeedback: {
                overall: "Good work! 2 out of 3 correct.",
                perQuestion: [
                  "Correct!",
                  "Correct!",
                  "Close, the answer is 267 LD.",
                ],
              },
              aiReviewed: true,
            },
          });
          logs.push("Created sample submission");
        }
      }
    }

    // Ensure today's scheduled lesson exists so the student Today page isn't empty
    const content = await prisma.curriculumContent.findFirst({
      where: { grade: 4, subject: "MATH", status: { in: ["published", "APPROVED"] } },
      select: { contentId: true },
    });
    if (content) {
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const nextDayUTC = new Date(todayUTC.getTime() + 86_400_000);

      const existingToday = await prisma.scheduledWork.findFirst({
        where: { classId: cls.id, scheduledDate: { gte: todayUTC, lt: nextDayUTC } },
        select: { id: true },
      });
      if (!existingToday) {
        await prisma.scheduledWork.create({
          data: {
            classId: cls.id,
            contentId: content.contentId,
            scheduledDate: todayUTC,
            createdById: teacher.id,
            isDelivered: false,
            classFormat: "standard",
            status: "confirmed",
          },
        });
        logs.push("Created today's scheduled lesson (Today page fix)");
      } else {
        logs.push("Today's scheduled lesson already exists");
      }
    }

    return NextResponse.json({ ok: true, logs });
  } catch (err: any) {
    console.error("Seed demo error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Seed failed" },
      { status: err?.status ?? 500 }
    );
  }
}
