import { EventCalendar } from "@/components/EventCalendar";

export default function GuardianEventsPage() {
  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-4xl space-y-6 px-4 py-5">
        <h1 className="text-xl font-semibold text-[var(--ll-text)]">School Calendar</h1>
        <EventCalendar role="GUARDIAN" compact={false} />
      </div>
    </main>
  );
}
