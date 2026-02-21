"use client";

import { useEffect, useState } from "react";

type ScheduleItem = {
  id: string;
  classId: string;
  className: string;
  contentId: string;
  title: string;
  subject: string;
  scheduledDate: string;
  completedCount: number;
  totalStudents: number;
};

type ClassInfo = { id: string; name: string };

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function TeacherSchedulePage() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(true);

  function loadSchedule(weekOf?: string) {
    setLoading(true);
    const url = weekOf ? `/api/teacher/schedule?weekOf=${weekOf}` : "/api/teacher/schedule";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setClasses(d.classes || []);
        setWeekStart(d.weekStart || "");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSchedule(); }, []);

  function getWeekDates(): Date[] {
    if (!weekStart) return [];
    const monday = new Date(weekStart);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      return d;
    });
  }

  function prevWeek() {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() - 7);
    loadSchedule(d.toISOString().slice(0, 10));
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + 7);
    loadSchedule(d.toISOString().slice(0, 10));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/teacher/schedule?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const weekDates = getWeekDates();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Weekly Schedule</h1>
            <p className="text-sm text-slate-400 mt-1">Manage lessons scheduled for your classes</p>
          </div>
          <div className="flex gap-2">
            <button onClick={prevWeek} className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">&larr; Prev</button>
            <button onClick={() => loadSchedule()} className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">This Week</button>
            <button onClick={nextWeek} className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Next &rarr;</button>
          </div>
        </div>

        {loading ? (
          <div className="h-60 rounded-2xl bg-slate-800/50 animate-pulse" />
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {weekDates.map((date, di) => {
              const dateStr = date.toISOString().slice(0, 10);
              const dayItems = items.filter(
                (i) => new Date(i.scheduledDate).toISOString().slice(0, 10) === dateStr
              );
              const isToday = dateStr === new Date().toISOString().slice(0, 10);

              return (
                <div key={di} className={`rounded-2xl border ${isToday ? "border-emerald-500/30" : "border-white/10"} bg-slate-900/70 p-3`}>
                  <p className={`text-xs font-semibold mb-2 ${isToday ? "text-emerald-400" : "text-slate-400"}`}>
                    {DAY_LABELS[di]} {date.getUTCDate()}
                  </p>
                  {dayItems.length === 0 ? (
                    <p className="text-[10px] text-slate-600">No lessons</p>
                  ) : (
                    <div className="space-y-1.5">
                      {dayItems.map((item) => {
                        const pct = item.totalStudents > 0 ? Math.round((item.completedCount / item.totalStudents) * 100) : 0;
                        return (
                          <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 group">
                            <p className="text-[11px] font-medium text-slate-200 truncate">{item.title}</p>
                            <p className="text-[9px] text-slate-500">{item.className}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[9px] text-emerald-400">{pct}% done</span>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-[9px] text-red-400 opacity-0 group-hover:opacity-100"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

