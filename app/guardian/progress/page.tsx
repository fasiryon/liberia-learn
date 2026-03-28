import { notFound, redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { isGuardianProgressViewEnabled } from "@/lib/serverFlags";
import { GuardianNav } from "@/components/guardian/GuardianNav";
import GuardianProgressClient from "@/app/guardian/progress/GuardianProgressClient";

export const dynamic = "force-dynamic";

export default async function GuardianProgressPage() {
  if (!isGuardianProgressViewEnabled()) {
    notFound();
  }

  const user = await getOptionalUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "GUARDIAN") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-5xl space-y-6">
        <GuardianNav />
        <GuardianProgressClient />
      </div>
    </main>
  );
}
