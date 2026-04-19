import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";
import { LegalFooter } from "@/components/LegalFooter";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <LegalFooter variant="portal" />
      <GlobalAssistantMount />
    </>
  );
}
