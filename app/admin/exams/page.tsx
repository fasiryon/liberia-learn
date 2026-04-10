import { redirect } from "next/navigation";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import AdminExamsClient from "./AdminExamsClient";

export default function AdminExamsPage() {
  if (!isExamSystemEnabled()) {
    redirect("/admin");
  }

  return <AdminExamsClient />;
}
