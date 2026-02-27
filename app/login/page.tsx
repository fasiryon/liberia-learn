import { isDemoModeEnabled } from "@/lib/serverFlags";
import { getDemoHintGroups, getDemoHintGroup, DEMO_PASSWORD_VALUE } from "@/lib/demoHints";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  const showDemoHints = isDemoModeEnabled();
  const demoGroups = showDemoHints ? getDemoHintGroups() : [];
  const demoDefaults = showDemoHints
    ? { email: getDemoHintGroup("student").email, password: DEMO_PASSWORD_VALUE }
    : null;

  return (
    <LoginClient
      showDemoHints={showDemoHints}
      demoGroups={demoGroups}
      demoDefaults={demoDefaults}
    />
  );
}
