import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listAuthorizedLearnerContent } from "@/lib/student/learnDiscovery.server";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { readingPages } from "@/components/textbooks/model";
import { TextbookReader } from "@/components/textbooks/TextbookReader";
import { preparedNarration } from "@/components/textbooks/narration.server";

export const dynamic = "force-dynamic";

export default async function TextbookReadingPage({ params }: { params: { contentId: string } }) {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { currentGrade: true, deletedAt: true, user: { select: { schoolId: true } } } });
  if (!student?.currentGrade || student.deletedAt || !user.schoolId || student.user.schoolId !== user.schoolId) notFound();
  const [row] = await listAuthorizedLearnerContent(user, { contentId: params.contentId, grade: student.currentGrade, contentType: "lesson" }, 1);
  if (!row) notFound();
  const projected = projectStudentLessonPayload(row.payload);
  if (projected.studentReady === false) notFound();
  const title = typeof projected.title === "string" ? projected.title : row.title ?? "Curriculum reading";
  // Audio is read only for the already authorized row at the same school and timestamp.
  // Optional audio failure never prevents reading. No generation is triggered.
  const audioRow = await prisma.curriculumContent.findFirst({ where: { id: row.id, schoolId: row.schoolId, updatedAt: row.updatedAt }, select: { version: true, audioAssets: { where: { status: "GENERATED" }, orderBy: { generatedAt: "desc" }, take: 1, select: { status: true, contentVersion: true, storageUrl: true, audioParts: true } } } }).catch(() => null);
  const narration = audioRow ? preparedNarration(audioRow.audioAssets[0], audioRow.version, row.payload) : undefined;
  return <TextbookReader key={`${row.contentId}:${row.updatedAt.toISOString()}`} persistenceScope={`${user.schoolId}:${user.id}`} book={{ id: row.contentId, version: row.updatedAt.toISOString(), title, subject: String(row.subject).replace(/_/g, " "), grade: row.grade, source: "authorized-reading", pages: readingPages(projected, title, row.grade), narration }} />;
}
