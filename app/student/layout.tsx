import SyncManager from "./SyncManager";
import OfflineBanner from "./OfflineBanner";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OfflineBanner />
      {children}
      <SyncManager />
    </>
  );
}

