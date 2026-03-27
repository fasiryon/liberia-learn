import SyncManager from "./SyncManager";
import OfflineBanner from "./OfflineBanner";
import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OfflineBanner />
      {children}
      <GlobalAssistantMount positionClassName="bottom-40 right-4" />
      <SyncManager />
    </>
  );
}
