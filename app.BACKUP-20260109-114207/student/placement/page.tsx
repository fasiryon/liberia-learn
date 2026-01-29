// app/student/placement/page.tsx
import { redirect } from "next/navigation";

export default function StudentPlacementRedirectPage() {
  // Send all student placement traffic to the live AI placement page
  redirect("/placement");
}
