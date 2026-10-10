import { requireRole } from "@/lib/auth";
import { LessonCatalog } from "@/components/student/learn/LessonCatalog";
export const dynamic = "force-dynamic";
export default async function StudentLessonsPage() {
  await requireRole("STUDENT");
  return <LessonCatalog />;
}
