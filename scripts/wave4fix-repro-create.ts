import { prisma } from "@/lib/db";
import { buildTeacherContentId, getTeacherClassOrThrow, inferClassGrade } from "@/lib/teacher/lessonAuthoring";

async function main() {
  const userId = "cmmsb7rpe000tvo78ypkoods2"; // teacher1@cha.edu.lr
  const classId = "cls-cha-math-0";
  try {
    const classRecord = await getTeacherClassOrThrow(userId, classId);
    console.log("CLASS OK:", JSON.stringify({ subject: (classRecord as any).subject, enrollments: (classRecord as any).enrollments?.length }));
    const grade = inferClassGrade((classRecord as any).enrollments);
    console.log("GRADE:", grade);
    const contentId = buildTeacherContentId(classId, "Quick Demo Lesson");
    console.log("CONTENT_ID:", contentId);
    const rec = await prisma.curriculumContent.create({
      data: {
        contentId,
        title: "Quick Demo Lesson",
        grade: grade ?? 7,
        subject: (classRecord as any).subject,
        contentType: "lesson",
        status: "draft",
        version: new Date().toISOString().slice(0, 10),
        payload: { title: "Quick Demo Lesson", body: "repro" } as any,
        moeAlignments: [] as any,
        teacherCreated: true,
      },
    });
    console.log("CREATE OK:", rec.id);
    await prisma.curriculumContent.delete({ where: { id: rec.id } });
    console.log("CLEANED UP");
  } catch (e: any) {
    console.error("THREW:", e?.constructor?.name, e?.code ?? "", e?.message?.slice(0, 500));
  }
}

main().finally(() => prisma.$disconnect());
