import GuardianDashboardClient from "./GuardianDashboardClient";
import { isDemoModeEnabled } from "@/lib/serverFlags";
import { getDemoHintGroup } from "@/lib/demoHints";

export default function GuardianPage() {
  const showDemoHints = isDemoModeEnabled();
  const demoGroup = showDemoHints ? getDemoHintGroup("guardian") : null;

  return (
    <GuardianDashboardClient
      showDemoHints={showDemoHints}
      demoGroup={demoGroup}
    />
  );
}
