"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

type CalEvent = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  type: string;
  visibility: string;
};

const TYPE_COLORS: Record<string, string> = {
  EXAM:         "bg-red-500/80 text-white",
  HOLIDAY:      "bg-green-600/80 text-white",
  MEETING:      "bg-amber-500/80 text-white",
  TRIP:         "bg-blue-500/80 text-white",
  ANNOUNCEMENT: "bg-[var(--ll-text-faint)]/70 text-white",
};
const TYPE_DOT: Record<string, string> = {
  EXAM:         "bg-red-500",
  HOLIDAY:      "bg-green-500",
  MEETING:      "bg-amber-500",
  TRIP:         "bg-blue-500",
  ANNOUNCEMENT: "bg-gray-400",
};

function typeBadge(type: string) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${TYPE_COLORS[type] ?? "bg-gray-500/70 text-white"}`}>
      {type}
    </span>
  );
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-LR", { weekday: "short", month: "short", day: "numeric" });
}

interface Props {
  role: string;
  compact?: boolean;
}

export function EventCalendar({ role, compact = false }: Props) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fetchEvents = useCallback(async (from: Date, to: Date) => {
    try {
      const res = await fetch(
        `/api/events?from=${from.toISOString()}&to=${to.toISOString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    if (compact) {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const sevenDaysOut = new Date(now);
      sevenDaysOut.setDate(now.getDate() + 7);
      fetchEvents(weekStart, sevenDaysOut);
    } else {
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
      fetchEvents(month, monthEnd);
    }
  }, [compact, month, fetchEvents]);

  const eventsBaseRoute = `/${role === "ADMIN" ? "admin" : role.toLowerCase()}/events`;

  if (compact) {
    return <CompactView events={events} loading={loading} role={role} baseRoute={eventsBaseRoute} />;
  }

  return (
    <FullView
      events={events}
      loading={loading}
      month={month}
      setMonth={setMonth}
      selectedDay={selectedDay}
      setSelectedDay={setSelectedDay}
    />
  );
}

function CompactView({
  events,
  loading,
  role,
  baseRoute,
}: {
  events: CalEvent[];
  loading: boolean;
  role: string;
  baseRoute: string;
}) {
  const today = new Date();
  const weekDays: Date[] = [];
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDays.push(d);
  }

  const dayLabel = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(today.getDate() + 7);

  const upcoming = events.filter((e) => {
    const d = new Date(e.eventDate);
    return d >= today && d <= sevenDaysOut;
  });

  function hasDayEvent(day: Date) {
    const dayStr = day.toISOString().slice(0, 10);
    return events.some((e) => e.eventDate.slice(0, 10) === dayStr);
  }
  function isToday(day: Date) {
    return day.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--ll-text)] flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[var(--ll-accent)]" strokeWidth={1.5} />
          Upcoming Events
        </h3>
        <Link href={baseRoute} className="text-xs font-semibold text-[var(--ll-yellow)] hover:underline">
          View All
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-[var(--ll-text-faint)]">{dayLabel[day.getDay()]}</span>
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              isToday(day)
                ? "bg-[var(--ll-accent)] text-[var(--ll-text-faint)]"
                : "text-[var(--ll-text-muted)]"
            }`}>
              {day.getDate()}
            </div>
            {hasDayEvent(day) ? (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ll-accent)]" />
            ) : (
              <span className="h-1.5 w-1.5" />
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-[var(--ll-text-muted)]">Loading…</p>
      ) : upcoming.length === 0 ? (
        <p className="text-xs text-[var(--ll-text-muted)]">No events in the next 7 days.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((e) => (
            <div key={e.id} className="flex items-start gap-2 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-2.5">
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[e.type] ?? "bg-gray-400"}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {typeBadge(e.type)}
                  <p className="text-xs font-semibold text-[var(--ll-text)] truncate">{e.title}</p>
                </div>
                <p className="mt-0.5 text-[10px] text-[var(--ll-text-faint)]">{formatEventDate(e.eventDate)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FullView({
  events,
  loading,
  month,
  setMonth,
  selectedDay,
  setSelectedDay,
}: {
  events: CalEvent[];
  loading: boolean;
  month: Date;
  setMonth: (d: Date) => void;
  selectedDay: string | null;
  setSelectedDay: (d: string | null) => void;
}) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const monthLabel = month.toLocaleDateString("en-LR", { month: "long", year: "numeric" });

  const firstDayOfMonth = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const cells: Array<number | null> = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  function dayStr(day: number) {
    return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function eventsForDay(day: number) {
    const ds = dayStr(day);
    return events.filter((e) => e.eventDate.slice(0, 10) === ds);
  }

  const selectedEvents = selectedDay
    ? events.filter((e) => e.eventDate.slice(0, 10) === selectedDay)
    : [];

  function prevMonth() {
    setMonth(new Date(year, monthIdx - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setMonth(new Date(year, monthIdx + 1, 1));
    setSelectedDay(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-lg border border-[var(--ll-border)] p-1.5 text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <h2 className="text-base font-semibold text-[var(--ll-text)]">{monthLabel}</h2>
        <button type="button" onClick={nextMonth} className="rounded-lg border border-[var(--ll-border)] p-1.5 text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg border border-[var(--ll-border)] overflow-hidden bg-[var(--ll-border)]">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="bg-[var(--ll-surface-muted)] py-1.5 text-center text-[10px] font-semibold uppercase text-[var(--ll-text-faint)]">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-[var(--ll-surface)] min-h-[3rem]" />;
          const ds = dayStr(day);
          const dayEvents = eventsForDay(day);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDay;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : ds)}
              className={`relative flex min-h-[3rem] flex-col items-start gap-1 p-1.5 text-left transition-colors ${
                isSelected
                  ? "bg-[var(--ll-accent-soft)]"
                  : "bg-[var(--ll-surface)] hover:bg-[var(--ll-surface-muted)]"
              }`}
            >
              <span className={`text-xs font-semibold leading-none ${isToday ? "text-[var(--ll-accent)]" : "text-[var(--ll-text-muted)]"}`}>
                {day}
              </span>
              <div className="flex flex-wrap gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[e.type] ?? "bg-gray-400"}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="space-y-2 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <p className="text-sm font-semibold text-[var(--ll-text)]">
            {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-LR", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-[var(--ll-text-muted)]">No events on this day.</p>
          ) : (
            selectedEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[e.type] ?? "bg-gray-400"}`} />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {typeBadge(e.type)}
                    <p className="text-sm font-semibold text-[var(--ll-text)]">{e.title}</p>
                  </div>
                  {e.description ? <p className="mt-1 text-xs text-[var(--ll-text-muted)]">{e.description}</p> : null}
                  <p className="mt-1 text-[10px] text-[var(--ll-text-faint)]">{formatEventDate(e.eventDate)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[var(--ll-text-muted)]">Loading events…</p>
      ) : null}
    </div>
  );
}
