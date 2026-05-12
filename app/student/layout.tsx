import SyncManager from "./SyncManager";
import OfflineBanner from "./OfflineBanner";
import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";
import { LegalFooter } from "@/components/LegalFooter";
import { getOptionalUser } from "@/lib/auth";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();
  const isPlatformAdmin = user?.isPlatformAdmin === true;

  return (
    <>
      <OfflineBanner />
      {children}
      <LegalFooter variant="portal" />
      <GlobalAssistantMount positionClassName="bottom-40 right-4" />
      <SyncManager isPlatformAdmin={isPlatformAdmin} />
      <PushPermissionPrompt />
    </>
  );
}
