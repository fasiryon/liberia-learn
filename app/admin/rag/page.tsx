import { notFound } from "next/navigation";
import GroundedQueryConsole from "@/components/rag/GroundedQueryConsole";
import { requireUser } from "@/lib/auth";
import { isRagTutorEnabled } from "@/lib/serverFlags";

export default async function AdminRagPage() {
  const user = await requireUser();

  if (!isRagTutorEnabled()) {
    notFound();
  }

  if (user.role !== "ADMIN" && user.role !== "TEACHER") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-6 py-10 text-slate-950">
      <GroundedQueryConsole />
    </main>
  );
}
