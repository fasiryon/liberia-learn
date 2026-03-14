import { redirect } from "next/navigation";

export default async function ScheduledWorkPage({
  params,
}: {
  params: { scheduledWorkId: string };
}) {
  redirect(`/student/lessons/${params.scheduledWorkId}`);
}
