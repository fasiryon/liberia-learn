import { redirect } from "next/navigation";
import GuardianDashboardClient from "@/app/guardian/GuardianDashboardClient";
import { isDemoModeEnabled, isGuardianPortalEnabled } from "@/lib/serverFlags";
import { getDemoHintGroup } from "@/lib/demoHints";

export default function GuardianDashboardPage() {
  if (!isGuardianPortalEnabled()) {
    redirect("/login");
  }

  const showDemoHints = isDemoModeEnabled();
  const demoGroup = showDemoHints ? getDemoHintGroup("guardian") : null;

  return (
    <GuardianDashboardClient
      showDemoHints={showDemoHints}
      demoGroup={demoGroup}
    />
  );
}
