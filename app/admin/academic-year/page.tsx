"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TermRecord = {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
};

type AcademicYear = {
  id: string;
  yearLabel: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  terms: TermRecord[];
};

const defaultTerms = [
  { name: "Term 1", startDate: "", endDate: "" },
  { name: "Term 2", startDate: "", endDate: "" },
  { name: "Term 3", startDate: "", endDate: "" },
];

export default function AcademicYearPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    yearLabel: "",
    startDate: "",
    endDate: "",
    isActive: true,
    terms: defaultTerms,
  });

  async function loadAcademicYears() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/academic-year", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load academic years");
      setAcademicYears(data.academicYears ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load academic years");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAcademicYears();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/academic-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create academic year");
      setAcademicYears((prev) => [data.academicYear, ...prev.filter((item) => item.id !== data.academicYear.id)]);
      setMessage("Academic year created.");
      setForm({
        yearLabel: "",
        startDate: "",
        endDate: "",
        isActive: false,
        terms: defaultTerms,
      });
      await loadAcademicYears();
    } catch (err: any) {
      setError(err.message ?? "Failed to create academic year");
    } finally {
      setSaving(false);
    }
  }

  async function activateAcademicYear(academicYearId: string) {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/academic-year", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYearId, isActive: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to activate academic year");
      setAcademicYears((prev) =>
        prev.map((item) => ({
          ...item,
          isActive: item.id === data.academicYear.id,
        }))
      );
      setMessage(`Activated ${data.academicYear.yearLabel}.`);
    } catch (err: any) {
      setError(err.message ?? "Failed to activate academic year");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header>
          <Link href="/admin" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Back to Admin Console
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Academic Year Management</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Define school years, activate the current year, and manage terms.</p>
        </header>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h2 className="mb-4 text-lg font-semibold">Create Academic Year</h2>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">Year Label</label>
                <input
                  value={form.yearLabel}
                  onChange={(e) => setForm((current) => ({ ...current, yearLabel: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
                  placeholder="2026-2027"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((current) => ({ ...current, startDate: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((current) => ({ ...current, endDate: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
                  required
                />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Terms</h3>
                <label className="flex items-center gap-2 text-xs text-[var(--ll-text)]">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))}
                  />
                  Set as active year
                </label>
              </div>
              <div className="grid gap-3">
                {form.terms.map((term, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-3">
                    <input
                      value={term.name}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          terms: current.terms.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: e.target.value } : item
                          ),
                        }))
                      }
                      className="min-h-11 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
                      placeholder={`Term ${index + 1}`}
                      required
                    />
                    <input
                      type="date"
                      value={term.startDate}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          terms: current.terms.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, startDate: e.target.value } : item
                          ),
                        }))
                      }
                      className="min-h-11 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
                      required
                    />
                    <input
                      type="date"
                      value={term.endDate}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          terms: current.terms.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, endDate: e.target.value } : item
                          ),
                        }))
                      }
                      className="min-h-11 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
                      required
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create Academic Year"}
              </button>
              {message ? <p className="text-xs text-[var(--ll-yellow)]">{message}</p> : null}
              {error ? <p className="text-xs text-red-300">{error}</p> : null}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Configured Academic Years</h2>
            <span className="text-xs text-[var(--ll-text-faint)]">{academicYears.length} total</span>
          </div>

          {loading ? (
            <div className="rounded-xl border border-[var(--ll-border)] bg-black/10 p-6 text-sm text-[var(--ll-text-muted)]">Loading academic years...</div>
          ) : academicYears.length === 0 ? (
            <div className="rounded-xl border border-[var(--ll-border)] bg-black/10 p-6 text-sm text-[var(--ll-text-muted)]">No academic years configured yet.</div>
          ) : (
            <div className="grid gap-4">
              {academicYears.map((year) => (
                <div key={year.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{year.yearLabel}</h3>
                        {year.isActive ? (
                          <span className="rounded-full bg-[var(--ll-yellow)]/15 px-2.5 py-1 text-[11px] font-semibold text-[var(--ll-yellow)]">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                        {new Date(year.startDate).toLocaleDateString()} to {new Date(year.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    {!year.isActive ? (
                      <button
                        type="button"
                        onClick={() => activateAcademicYear(year.id)}
                        className="rounded-xl border border-emerald-500/30 px-4 py-2 text-sm text-[var(--ll-yellow)] hover:border-emerald-400/40 hover:text-[var(--ll-yellow)]"
                      >
                        Set Active
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {year.terms.map((term) => (
                      <div key={term.id ?? term.name} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4">
                        <p className="text-sm font-semibold text-[var(--ll-text)]">{term.name}</p>
                        <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                          {new Date(term.startDate).toLocaleDateString()} to {new Date(term.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
