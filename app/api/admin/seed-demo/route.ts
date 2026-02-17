import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEMO_SCHOOL_ID = "demo-school-monrovia";

export async function POST() {
  try {
    const user = await requireRole("ADMIN");

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
        where: { id: DEMO_SCHOOL_ID },
        select: { id: true },
      });
      if (demoSchool) {
        await prisma.user.update({
          where: { id: user.id },
          data: { schoolId: DEMO_SCHOOL_ID },
        });
        schoolId = DEMO_SCHOOL_ID;
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

    // Create homework if none
    let hw = await prisma.homework.findFirst({
      where: { classId: cls.id },
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
          questions: [
            { question: "What is 245 + 378?", type: "FR" },
            { question: "What is 500 - 167?", type: "FR" },
            {
              question:
                "A market woman has 456 Liberian dollars. She spends 189. How much is left?",
              type: "FR",
            },
          ],
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      logs.push(`Created homework: ${hw.title}`);
    } else {
      logs.push(`Homework exists: ${hw.title}`);
    }

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

    return NextResponse.json({ ok: true, logs });
  } catch (err: any) {
    console.error("Seed demo error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Seed failed" },
      { status: err?.status ?? 500 }
    );
  }
}
