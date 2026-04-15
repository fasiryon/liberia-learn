import { requireRole } from "@/lib/auth";

import StudentProgressDashboard from "@/components/student/StudentProgressDashboard";

export default async function StudentProgressPage() {
  await requireRole("STUDENT");

  return <StudentProgressDashboard />;
}
