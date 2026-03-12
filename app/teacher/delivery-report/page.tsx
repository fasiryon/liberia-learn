import Link from "next/link";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { TeacherDeliveryReport } from "@/components/teacher/TeacherDeliveryReport";

export default function TeacherDeliveryReportPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <Link href="/teacher" className="text-xs text-emerald-300 hover:text-emerald-200">
            Back to Teacher Dashboard
          </Link>
        </header>
        <TeacherNav />
        <TeacherDeliveryReport />
      </div>
    </main>
  );
}
