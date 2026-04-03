import { redirect } from "next/navigation";
import GuardianDashboardClient from "@/app/guardian/GuardianDashboardClient";
import { isGuardianPortalEnabled } from "@/lib/serverFlags";

export default function GuardianDashboardPage() {
  if (!isGuardianPortalEnabled()) {
    redirect("/login");
  }

  return <GuardianDashboardClient />;
}
