import SyncManager from "./SyncManager";
import OfflineBanner from "./OfflineBanner";
import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";
import { getOptionalUser } from "@/lib/auth";

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
      <GlobalAssistantMount positionClassName="bottom-40 right-4" />
      <SyncManager isPlatformAdmin={isPlatformAdmin} />
    </>
  );
}
