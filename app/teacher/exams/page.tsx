import { redirect } from "next/navigation";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import TeacherExamsClient from "./TeacherExamsClient";

export default function TeacherExamsPage() {
  if (!isExamSystemEnabled()) {
    redirect("/teacher");
  }

  return <TeacherExamsClient />;
}
