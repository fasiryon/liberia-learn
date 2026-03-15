import { redirect } from "next/navigation";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import StudentExamsClient from "./StudentExamsClient";

export default function StudentExamsPage() {
  if (!isExamSystemEnabled()) {
    redirect("/dashboard");
  }

  return <StudentExamsClient />;
}
