import { requireRole } from "@/lib/auth";

import StudentCertificatesClient from "@/components/student/StudentCertificatesClient";

export default async function StudentCertificatesPage() {
  await requireRole("STUDENT");

  return <StudentCertificatesClient />;
}
