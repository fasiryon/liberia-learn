import { redirect } from "next/navigation";
import GuardianDashboardClient from "./GuardianDashboardClient";
import { isDemoModeEnabled, isGuardianPortalEnabled } from "@/lib/serverFlags";
import { getDemoHintGroup } from "@/lib/demoHints";

export default function GuardianPage() {
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
