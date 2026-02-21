import { redirect } from "next/navigation";

/**
 * Legacy white student dashboard.
 * Redirect to the canonical dark dashboard at /dashboard.
 */
export default function LegacyStudentDashboard() {
  redirect("/dashboard");
}

