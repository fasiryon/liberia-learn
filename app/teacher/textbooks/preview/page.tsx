import { requireRole } from "@/lib/auth";
import { TextbookReader } from "@/components/textbooks/TextbookReader";
import { demoBook } from "@/components/textbooks/demoBook";

export const dynamic = "force-dynamic";
export default async function TeacherTextbookPreview() {
  await requireRole("TEACHER", "ADMIN");
  return <TextbookReader book={demoBook} backHref="/teacher" preview />;
}
