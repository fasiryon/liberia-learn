import { getDemoHintGroups } from "@/lib/demoHints";
import {
  getDemoCredential,
  shouldShowDemoCredentials,
} from "@/lib/demoCredentials";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  const showDemoHints = shouldShowDemoCredentials();
  const demoGroups = showDemoHints ? getDemoHintGroups() : [];
  const demoDefaults = showDemoHints
    ? (() => {
        const credential = getDemoCredential("student");
        return { email: credential.email, password: credential.password };
      })()
    : null;

  return (
    <LoginClient
      showDemoHints={showDemoHints}
      demoGroups={demoGroups}
      demoDefaults={demoDefaults}
    />
  );
}
