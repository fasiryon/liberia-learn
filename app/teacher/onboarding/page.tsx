"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string; county?: string | null };
type Profile = {
  fullName: string;
  phone: string | null;
  gradesTaught: string[];
  subjectsTaught: string[];
  isOnboarded: boolean;
};

export default function TeacherOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [schoolId, setSchoolId] = useState<string>("");
  const [schools, setSchools] = useState<Option[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [schoolAssignmentRequired, setSchoolAssignmentRequired] = useState(false);
  const [form, setForm] = useState<Profile>({
    fullName: "",
    phone: "",
    gradesTaught: [],
    subjectsTaught: [],
    isOnboarded: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/teacher/onboarding", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (data?.profile) {
          setForm({
            fullName: data.profile.fullName ?? "",
            phone: data.profile.phone ?? "",
            gradesTaught: data.profile.gradesTaught ?? [],
            subjectsTaught: data.profile.subjectsTaught ?? [],
            isOnboarded: Boolean(data.profile.isOnboarded),
          });
          if (data.profile.isOnboarded) {
            setStep(3);
          }
        }
        setSchoolId(data?.user?.schoolId ?? data?.profile?.schoolId ?? "");
        setSchools(data?.schools ?? []);
        setGrades(data?.options?.grades ?? []);
        setSubjects(data?.options?.subjects ?? []);
        setSchoolAssignmentRequired(Boolean(data?.schoolAssignmentRequired));
      } catch {
        setError("Could not load onboarding data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  const canAdvanceStep1 = schoolId.length > 0 && !schoolAssignmentRequired;
  const canAdvanceStep2 = form.fullName.trim().length > 1;
  const canAdvanceStep3 = form.gradesTaught.length > 0 && form.subjectsTaught.length > 0;

  const gradeOptions = useMemo(() => grades, [grades]);
  const subjectOptions = useMemo(() => subjects, [subjects]);

  function toggleArrayItem(list: string[], value: string) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function handleComplete() {
    setError(null);
    if (!canAdvanceStep1) {
      setError("Select a school to continue.");
      return;
    }
    if (!canAdvanceStep2) {
      setError("Full name is required.");
      return;
    }
    if (!canAdvanceStep3) {
      setError("Select at least one grade and subject.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/teacher/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          fullName: form.fullName,
          phone: form.phone,
          gradesTaught: form.gradesTaught,
          subjectsTaught: form.subjectsTaught,
          complete: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete onboarding.");
      router.push("/teacher");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
        <p className="text-sm text-slate-400">Loading onboarding...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Teacher Onboarding</h1>
          <p className="text-sm text-slate-400">
            Complete your profile and teaching preferences.
          </p>
        </div>

        <div className="flex gap-2 text-xs text-slate-400">
          <span className={step === 1 ? "text-emerald-300" : ""}>1. School</span>
          <span>•</span>
          <span className={step === 2 ? "text-emerald-300" : ""}>2. Profile</span>
          <span>•</span>
          <span className={step === 3 ? "text-emerald-300" : ""}>3. Grades & Subjects</span>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Confirm your school</h2>
              {schoolAssignmentRequired ? (
                <p className="text-sm text-amber-300">
                  School assignment is required. Please contact your school admin.
                </p>
              ) : schoolId && schools.length === 0 ? (
                <p className="text-sm text-slate-300">
                  School attached: <span className="text-emerald-300">{schoolId}</span>
                </p>
              ) : (
                <label className="block text-sm">
                  <span className="text-slate-400">Select school</span>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={schoolId}
                    onChange={(e) => setSchoolId(e.target.value)}
                  >
                    <option value="">Choose a school</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.county ? `(${s.county})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => canAdvanceStep1 && setStep(2)}
                  className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                  disabled={!canAdvanceStep1}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Teacher profile</h2>
              <label className="block text-sm">
                <span className="text-slate-400">Full name *</span>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Phone (optional)</span>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-slate-400 hover:text-slate-200"
                >
                  Back
                </button>
                <button
                  onClick={() => canAdvanceStep2 && setStep(3)}
                  className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                  disabled={!canAdvanceStep2}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Grades & subjects</h2>
              <div>
                <p className="text-sm text-slate-400 mb-2">Grades taught *</p>
                <div className="flex flex-wrap gap-2">
                  {gradeOptions.map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          gradesTaught: toggleArrayItem(prev.gradesTaught, grade),
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${
                        form.gradesTaught.includes(grade)
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                          : "border-slate-700 text-slate-300"
                      }`}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-2">Subjects taught *</p>
                <div className="flex flex-wrap gap-2">
                  {subjectOptions.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          subjectsTaught: toggleArrayItem(prev.subjectsTaught, subject),
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${
                        form.subjectsTaught.includes(subject)
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                          : "border-slate-700 text-slate-300"
                      }`}
                    >
                      {subject.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="text-sm text-slate-400 hover:text-slate-200"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  disabled={saving || !canAdvanceStep3}
                >
                  {saving ? "Saving..." : "Complete onboarding"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </section>
      </div>
    </main>
  );
}
