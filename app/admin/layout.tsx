import { AdminSidebar } from "@/components/admin/AdminSidebar";
import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";
import { LegalFooter } from "@/components/LegalFooter";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--ll-bg)]">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-1">{children}</div>
        <LegalFooter variant="portal" />
      </div>
      <GlobalAssistantMount />
    </div>
  );
}
