import { redirect } from "next/navigation";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import StudentCertificationsClient from "./StudentCertificationsClient";

export default function StudentCertificationsPage() {
  if (!isExamSystemEnabled()) {
    redirect("/dashboard");
  }

  return <StudentCertificationsClient />;
}
