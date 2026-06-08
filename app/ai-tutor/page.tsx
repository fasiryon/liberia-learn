import Link from "next/link";
import AiTutorChat from "@/components/AiTutorChat";

export default function AiTutorPage() {
  return (
    <main className="min-h-screen bg-[#05060a] text-[var(--ll-text)] flex flex-col p-6">
      <nav className="mb-4">
        <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] transition-colors hover:opacity-80">
          &larr; Back to Dashboard
        </Link>
      </nav>
      <div className="flex flex-1 items-center justify-center">
        <AiTutorChat />
      </div>
    </main>
  );
}