import SyncManager from "./SyncManager";
import OfflineBanner from "./OfflineBanner";
import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";
import { LegalFooter } from "@/components/LegalFooter";
import { getOptionalUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { StudentTourMount } from "@/components/tours/TourMount";
import { PrivacyGateMount } from "@/components/PrivacyGateMount";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();
  const isPlatformAdmin = user?.isPlatformAdmin === true;

  let showPrivacyGate = false;
  let showTour = false;

  if (user?.role === "STUDENT") {
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { privacyAcceptedAt: true, tourCompletedAt: true },
    });
    showPrivacyGate = !record?.privacyAcceptedAt;
    showTour = !!record?.privacyAcceptedAt && !record?.tourCompletedAt;
  }

  return (
    <>
      <OfflineBanner />
      {children}
      <LegalFooter variant="portal" />
      <GlobalAssistantMount positionClassName="bottom-40 right-4" />
      <SyncManager isPlatformAdmin={isPlatformAdmin} />
      <PushPermissionPrompt />
      <PwaInstallPrompt />
      <PrivacyGateMount showGate={showPrivacyGate} />
      <StudentTourMount showTour={showTour} />
    </>
  );
}
