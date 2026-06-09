// WAVE 4-FIX Phase 3 verification: confirm StudentProgress row exists for a
// teacher lesson completion, plus the virtual ScheduledWork that carries it.
// Run: npx dotenv -e .env.production -- npx tsx scripts/wave4fix-verify.ts --contentId <id>
import { prisma } from "@/lib/db";

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? (process.argv[idx + 1] ?? null) : null;
}

async function main() {
  const contentId = arg("contentId");
  const title = arg("title");
  if (!contentId && !title) {
    console.error("Usage: --contentId <id> | --title <substring>");
    process.exit(1);
  }

  const content = await prisma.curriculumContent.findFirst({
    where: contentId
      ? { contentId }
      : { title: { contains: title!, mode: "insensitive" }, teacherCreated: true },
    select: {
      id: true,
      contentId: true,
      title: true,
      subject: true,
      grade: true,
      teacherCreated: true,
      editReviewStatus: true,
      status: true,
      publishedAt: true,
      visibility: true,
      editedBy: { select: { name: true, email: true } },
    },
  });
  if (!content) {
    console.log("CONTENT: not found");
    process.exit(2);
  }
  console.log("CONTENT:", JSON.stringify(content, null, 2));

  const assignments = await prisma.teacherLessonAssignment.findMany({
    where: { contentId: content.contentId },
    select: { id: true, classId: true, scheduledFor: true, createdAt: true },
  });
  console.log("ASSIGNMENTS:", JSON.stringify(assignments, null, 2));

  const sws = await prisma.scheduledWork.findMany({
    where: { contentId: content.contentId },
    select: { id: true, classId: true, scheduledDate: true, status: true, createdById: true },
  });
  console.log("SCHEDULED_WORK:", JSON.stringify(sws, null, 2));

  if (sws.length) {
    const progress = await prisma.studentProgress.findMany({
      where: { scheduledWorkId: { in: sws.map((s) => s.id) } },
      select: {
        id: true,
        studentId: true,
        scheduledWorkId: true,
        startedAt: true,
        completedAt: true,
        exitTicketScore: true,
        student: { select: { email: true, name: true } },
      },
    });
    console.log("STUDENT_PROGRESS:", JSON.stringify(progress, null, 2));
  } else {
    console.log("STUDENT_PROGRESS: no ScheduledWork rows yet");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
