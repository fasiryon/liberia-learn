import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import TeacherProfileClient from "@/app/teacher/profile/TeacherProfileClient";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  if (user.role !== "TEACHER") redirect("/");

  return <TeacherProfileClient />;
}
