"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StudentRow = {
  studentId: string;
  userId: string;
  name: string;
  className: string;
  lessonsCompletedThisWeek: number;
  lastActive: string | null;
  status: "active" | "at-risk" | "inactive";
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/20 text-emerald-300" },
  "at-risk": { label: "At Risk", cls: "bg-amber-500/20 text-amber-300" },
  inactive: { label: "Inactive", cls: "bg-red-500/20 text-red-300" },
};

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/students")
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Students</h1>
        <p className="text-sm text-slate-400 mt-1">Monitor student progress across your classes</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-800/50 animate-pulse" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400">No students enrolled in your classes yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Class</th>
                <th className="px-4 py-3 text-center">This Week</th>
                <th className="px-4 py-3 text-left">Last Active</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const style = STATUS_STYLE[s.status];
                return (
                  <tr key={`${s.studentId}-${s.className}`} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <Link href={`/teacher/students/${s.studentId}`} className="text-slate-100 hover:text-emerald-400">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.className}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{s.lessonsCompletedThisWeek}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${style.cls}`}>
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

