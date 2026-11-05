import { AdminSidebar } from "@/components/admin/AdminSidebar";
import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";
import { LegalFooter } from "@/components/LegalFooter";
import { AdminTourMount } from "@/components/tours/TourMount";
import { getOptionalUser } from "@/lib/auth";
import { enforceAdmittedSession } from "@/lib/auth/admittedSession";
import { prisma } from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();
  // U1: middleware admitted a signed token, but the server session is gone (revoked, disabled, changed or unverifiable).
  enforceAdmittedSession(user);
  const showTour =
    user?.role === "ADMIN"
      ? !(
          await prisma.user.findUnique({
            where: { id: user.id },
            select: { tourCompletedAt: true },
          })
        )?.tourCompletedAt
      : false;

  return (
    <div className="flex min-h-screen bg-[var(--ll-bg)]">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-1 pt-6 px-6">{children}</div>
        <LegalFooter variant="portal" />
      </div>
      <AdminTourMount showTour={!!showTour} />
      <GlobalAssistantMount />
    </div>
  );
}
