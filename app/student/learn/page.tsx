import { requireRole } from "@/lib/auth";
import { LearnV2 } from "@/components/student/learn/LearnV2";
export const dynamic = "force-dynamic";
export default async function StudentLearnPage() {
  await requireRole("STUDENT");
  return <LearnV2 />;
}
