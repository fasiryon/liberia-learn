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
import { StudentAccessibilityControl } from "@/components/student/StudentAccessibilityControl";
import { StudentShellV2, StudentOptionalPrompts } from "@/components/student/StudentShellV2";

const A11Y_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE === "true";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();
  const isPlatformAdmin = user?.isPlatformAdmin === true;

  let showPrivacyGate = false;
  let showTour = false;
  let grade: number | null = null;

  if (user?.role === "STUDENT") {
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { privacyAcceptedAt: true, tourCompletedAt: true },
    });
    showPrivacyGate = !record?.privacyAcceptedAt;
    showTour = !!record?.privacyAcceptedAt && !record?.tourCompletedAt;
    const student = await prisma.student.findFirst({ where: { userId: user.id, user: { schoolId: user.schoolId } }, select: { currentGrade: true } });
    grade = student?.currentGrade ?? null;
  }

  return (
    <StudentShellV2 identity={{ name: user?.name ?? "Learner", grade, userId: user?.id ?? "", schoolId: user?.schoolId ?? null }} utilities={<>
      <LegalFooter variant="portal" />
      <StudentOptionalPrompts><GlobalAssistantMount positionClassName="bottom-40 right-4" /></StudentOptionalPrompts>
      <SyncManager isPlatformAdmin={isPlatformAdmin} />
      <StudentOptionalPrompts><PushPermissionPrompt /><PwaInstallPrompt /></StudentOptionalPrompts>
      <PrivacyGateMount showGate={showPrivacyGate} />
      <StudentOptionalPrompts><StudentTourMount showTour={showTour} /></StudentOptionalPrompts>
      {A11Y_ENABLED && <StudentAccessibilityControl />}
    </>}>
      <OfflineBanner />
      {children}
    </StudentShellV2>
  );
}
