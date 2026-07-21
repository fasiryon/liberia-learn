import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireUser } from "@/lib/auth";
import InteroperabilityClient from "./InteroperabilityClient";

export const dynamic = "force-dynamic";

export default async function InteroperabilityPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <AdminNav />
        <header className="border-b border-[var(--ll-border)] pb-5">
          <p className="text-xs font-semibold uppercase text-[var(--ll-yellow)]">Data Exchange</p>
          <h1 className="mt-2 text-3xl font-bold">Interoperability</h1>
        </header>
        <InteroperabilityClient />
      </div>
    </main>
  );
}
