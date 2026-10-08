import { requireRole } from "@/lib/auth";
import { TodayV2 } from "@/components/student/TodayV2";
export const dynamic = "force-dynamic";
export default async function StudentTodayPage() {
  await requireRole("STUDENT");
  return <TodayV2 />;
}
