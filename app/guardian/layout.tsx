import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";
import { getOptionalUser } from "@/lib/auth";
import { GuardianShell } from "@/app/guardian/GuardianShell";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export default async function GuardianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();
  return (
    <>
      <GuardianShell enableWelcomeGate={user?.role === "GUARDIAN"}>
        {children}
      </GuardianShell>
      <GlobalAssistantMount />
      <PushPermissionPrompt />
      <PwaInstallPrompt />
    </>
  );
}
