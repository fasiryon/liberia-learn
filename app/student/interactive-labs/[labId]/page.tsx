import { redirect } from "next/navigation";

// Product Redesign V1: one Labs product surface. Interactive labs now live at /student/labs/[labId];
// this route stays as a compatibility redirect so existing links keep working.
export default function InteractiveLabRedirect({ params }: { params: { labId: string } }) {
  redirect(`/student/labs/${encodeURIComponent(params.labId)}`);
}
