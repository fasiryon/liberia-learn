import { notFound, redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import {
  isPilotReadinessDashboardEnabled,
  isPilotReadinessEnabled,
} from "@/lib/serverFlags";
import PilotReadinessClient from "@/app/admin/pilot-readiness/PilotReadinessClient";

export const dynamic = "force-dynamic";

export default async function PilotReadinessPage() {
  if (!isPilotReadinessDashboardEnabled() || !isPilotReadinessEnabled()) {
    notFound();
  }

  const user = await getOptionalUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl">
        <PilotReadinessClient />
      </div>
    </main>
  );
}
