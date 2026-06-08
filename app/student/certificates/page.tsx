import { requireRole } from "@/lib/auth";

// WhatsAppShareButton is rendered per-certificate inside StudentCertificatesClient
import StudentCertificatesClient from "@/components/student/StudentCertificatesClient";

export default async function StudentCertificatesPage() {
  await requireRole("STUDENT");

  return <StudentCertificatesClient />;
}
