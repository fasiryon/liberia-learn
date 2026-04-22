"use client";

import { FormEvent, useEffect, useState } from "react";

type CurriculumVersionRow = {
  id: string;
  versionName: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdAt: string;
  _count?: { contents: number };
};

export default function MoeCurriculumPage() {
  const [versions, setVersions] = useState<CurriculumVersionRow[]>([]);
  const [versionName, setVersionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadVersions() {
    const res = await fetch("/api/moe/curriculum/version", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error ?? "Failed to load curriculum versions");
    }
    setVersions(data.versions ?? []);
  }

  useEffect(() => {
    loadVersions().catch((err) => setError(err.message));
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/moe/curriculum/version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionName }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "Failed to create version");
      }
      setVersionName("");
      await loadVersions();
    } catch (err: any) {
      setError(err.message ?? "Failed to create version");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(versionId: string, archive = false) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/moe/curriculum/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, archive }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "Failed to update curriculum version");
      }
      await loadVersions();
    } catch (err: any) {
      setError(err.message ?? "Failed to update curriculum version");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--ll-yellow)]">Curriculum Control</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">National Curriculum Versions</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--ll-text-muted)]">
          Create, activate, and archive national curriculum versions. Version state is enforced server-side before publication.
        </p>
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={versionName}
            onChange={(event) => setVersionName(event.target.value)}
            placeholder="2026 National Curriculum"
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create Version"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-[var(--ll-danger)]">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-[var(--ll-text)]">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-[var(--ll-text-faint)]">
              <tr>
                <th className="pb-3">Version</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Content Rows</th>
                <th className="pb-3">Created</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-t border-white/5">
                  <td className="py-3">{version.versionName}</td>
                  <td className="py-3">{version.status}</td>
                  <td className="py-3">{version._count?.contents ?? 0}</td>
                  <td className="py-3">{new Date(version.createdAt).toLocaleString()}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {version.status !== "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => handlePublish(version.id, false)}
                          className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-[var(--ll-yellow)]"
                        >
                          Activate
                        </button>
                      ) : null}
                      {version.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          onClick={() => handlePublish(version.id, true)}
                          className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-[var(--ll-yellow)]"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
