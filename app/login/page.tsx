import { getDemoHintGroups } from "@/lib/demoHints";
import {
  getDemoCredential,
  shouldShowDemoCredentials,
} from "@/lib/demoCredentials";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  let showDemoHints = false;
  let demoGroups: ReturnType<typeof getDemoHintGroups> = [];
  let demoDefaults: { email: string; password: string } | null = null;

  try {
    showDemoHints = shouldShowDemoCredentials();
    if (showDemoHints) {
      demoGroups = getDemoHintGroups();
      const credential = getDemoCredential("student");
      demoDefaults = { email: credential.email, password: credential.password };
    }
  } catch {
    // Non-critical: demo hints are optional. Login still works without them.
  }

  return (
    <LoginClient
      showDemoHints={showDemoHints}
      demoGroups={demoGroups}
      demoDefaults={demoDefaults}
    />
  );
}
