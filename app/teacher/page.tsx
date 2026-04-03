import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const user = await requireUser();

  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    redirect("/");
  }

  redirect("/teacher/dashboard");
}
