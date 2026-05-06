import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const all = await prisma.curriculumContent.findMany({
    where: { status: 'NEEDS_REVIEW' },
    select: { contentId: true, grade: true, subject: true, title: true, payload: true },
  });

  const borderline: any[] = [];

  for (const l of all) {
    const payload = l.payload as any;
    const content: string = payload?.lessonContent ?? payload?.content ?? payload?.lessonBody ?? '';
    const questions: any[] = payload?.quiz?.questions ?? payload?.assessmentQuestions ?? [];
    const teacherNotes: string = payload?.teacherNotesSummary ?? payload?.teacherGuide ?? '';

    // Content ok but teacher notes short
    if (content.length >= 2000 && teacherNotes.length < 20) {
      borderline.push({
        id: l.contentId,
        grade: l.grade,
        subject: l.subject,
        title: l.title,
        contentLen: content.length,
        teacherNotesLen: teacherNotes.length,
        questions: questions.length,
        contentPreview: content.slice(0, 200),
      });
    }
  }

  console.log('Borderline lessons (content ok, teacher notes short):', borderline.length);
  for (const b of borderline) {
    console.log('---');
    console.log('ID:', b.id);
    console.log(`Grade ${b.grade} ${b.subject} | Content: ${b.contentLen} chars | Questions: ${b.questions} | TeacherNotes: ${b.teacherNotesLen}`);
    console.log('Title:', b.title);
    console.log('Preview:', b.contentPreview);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
