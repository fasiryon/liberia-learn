import { notFound, redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import {
  isPilotReadinessDashboardEnabled,
  isPilotReadinessEnabled,
} from "@/lib/serverFlags";
import OnboardingReadinessClient from "@/app/admin/onboarding/readiness/OnboardingReadinessClient";

export const dynamic = "force-dynamic";

export default async function OnboardingReadinessPage() {
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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-5xl">
        <OnboardingReadinessClient />
      </div>
    </main>
  );
}
