// app/student/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StudentProfile {
  id: string;
  name?: string;
  email?: string;
  gradeLevel?: string;
  placementGrade?: number;
}

interface StudentProfilePageProps {
  params: { id: string };
}

export default function StudentProfilePage({ params }: StudentProfilePageProps) {
  const { id } = params;
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStudent = async () => {
      try {
        // This assumes you’ll eventually create /api/student/[id]
        const res = await fetch(`/api/student/${id}`);
        if (!res.ok) {
          // If the API doesn’t exist yet, we still show the page
          setError("Could not load full profile (API not ready yet).");
          setStudent({ id });
          return;
        }
        const data = await res.json();
        setStudent({
          id: data.id ?? id,
          name: data.name,
          email: data.email,
          gradeLevel: data.gradeLevel,
          placementGrade: data.placementGrade,
        });
      } catch (err) {
        console.error("Failed to load student profile:", err);
        setError("Could not load full profile.");
        setStudent({ id });
      } finally {
        setLoading(false);
      }
    };

    loadStudent();
  }, [id]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300 mb-2">
              LIBERIALEARN · STUDENT
            </p>
            <h1 className="text-2xl font-bold">Student Profile</h1>
            <p className="text-sm text-slate-400 mt-1">
              ID: <span className="font-mono">{id}</span>
            </p>
          </div>
          <Link
            href="/teacher"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            ← Back to teacher dashboard
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Basic Info */}
          <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
              Basic Information
            </h2>

            {loading ? (
              <p className="text-slate-400 text-sm">Loading profile…</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name</span>
                  <span className="font-semibold">
                    {student?.name ?? "Not set"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email</span>
                  <span className="font-semibold">
                    {student?.email ?? "Not set"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Grade Level</span>
                  <span className="font-semibold">
                    {student?.gradeLevel ?? "Not set"}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 text-xs text-red-400">
                {error} You can still view the page; hook this up to your real
                student API later.
              </p>
            )}
          </div>

          {/* Placement Summary */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
              Placement Summary
            </h2>
            <p className="text-sm text-slate-300 mb-1">
              Recommended Grade:
            </p>
            <p className="text-3xl font-bold text-emerald-300 mb-3">
              {student?.placementGrade
                ? `Grade ${student.placementGrade}`
                : "Not set"}
            </p>
            <Link
              href="/placement"
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              View / Run Placement Test
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
