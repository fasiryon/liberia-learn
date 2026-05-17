import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";
import { getOptionalUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GuardianShell } from "@/app/guardian/GuardianShell";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { GuardianTourMount } from "@/components/tours/TourMount";

export default async function GuardianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();

  const showTour =
    user?.role === "GUARDIAN"
      ? !(
          await prisma.user.findUnique({
            where: { id: user.id },
            select: { tourCompletedAt: true },
          })
        )?.tourCompletedAt
      : false;

  return (
    <>
      <GuardianShell enableWelcomeGate={user?.role === "GUARDIAN"}>
        {children}
      </GuardianShell>
      <GuardianTourMount showTour={!!showTour} />
      <GlobalAssistantMount />
      <PushPermissionPrompt />
      <PwaInstallPrompt />
    </>
  );
}
