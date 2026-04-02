import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import TeacherWelcomeClient from "@/app/teacher/welcome/TeacherWelcomeClient";

export const dynamic = "force-dynamic";

export default async function TeacherWelcomePage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  if (user.role !== "TEACHER") redirect("/");

  return <TeacherWelcomeClient teacherName={user.name ?? "Teacher"} />;
}
