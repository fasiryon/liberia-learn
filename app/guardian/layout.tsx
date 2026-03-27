import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";

export default function GuardianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <GlobalAssistantMount />
    </>
  );
}
