import { redirect } from "next/navigation";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import StudentExamSessionClient from "./StudentExamSessionClient";

export default function StudentExamSessionPage({ params }: { params: { examId: string } }) {
  if (!isExamSystemEnabled()) {
    redirect("/dashboard");
  }

  return <StudentExamSessionClient examId={params.examId} />;
}
