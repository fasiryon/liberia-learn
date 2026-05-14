import { EventCalendar } from "@/components/EventCalendar";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function GuardianEventsPage() {
  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
        <Link
          href="/guardian/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <h1 className="text-xl font-semibold text-[var(--ll-text)]">School Calendar</h1>
        <EventCalendar role="GUARDIAN" compact={false} />
      </div>
    </main>
  );
}
