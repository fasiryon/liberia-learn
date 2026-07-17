"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";

type UpdateListItem = {
  id: string;
  type: string;
  scope: string;
  scopeId: string;
  status: string;
  createdAt: string;
};

type UpdateDetail = UpdateListItem & {
  draftText: string;
  dataSnapshot: unknown;
  changesSummary: unknown;
};

type DistrictUpdatesClientProps = {
  isPlatformAdmin: boolean;
  districts: string[];
  schools: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string; schoolId: string }>;
};

export default function DistrictUpdatesClient({ isPlatformAdmin, districts, schools, classes }: DistrictUpdatesClientProps) {
  const [updates, setUpdates] = useState<UpdateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UpdateDetail | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [draftKind, setDraftKind] = useState<"standings" | "milestone">("standings");
  const [standingsScope, setStandingsScope] = useState<"district" | "school">("district");
  const [standingsScopeId, setStandingsScopeId] = useState("");
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [milestoneScope, setMilestoneScope] = useState<"school" | "class">("school");
  const [milestoneScopeId, setMilestoneScopeId] = useState("");

  async function loadUpdates() {
    setLoading(true);
    try {
      const res = await fetch("/api/district-updates");
      const data = await res.json();
      setUpdates(Array.isArray(data.updates) ? data.updates : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUpdates();
  }, []);

  async function viewUpdate(id: string) {
    const res = await fetch(`/api/district-updates/${id}`);
    const data = await res.json();
    if (data.update) setSelected(data.update);
  }

  async function generate() {
    setRunning(true);
    setRunStatus(null);
    try {
      const body =
        draftKind === "standings"
          ? { type: "standings", scope: standingsScope, scopeId: standingsScopeId, periodType }
          : { type: "milestone", scope: milestoneScope, scopeId: milestoneScopeId };

      const res = await fetch("/api/admin/agents/district-update/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setRunStatus(data.status ?? data.error ?? "unknown");
      await loadUpdates();
    } finally {
      setRunning(false);
    }
  }

  const canGenerate =
    draftKind === "standings" ? Boolean(standingsScopeId) : Boolean(milestoneScopeId);

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
        <div>
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-[var(--ll-yellow)] hover:underline">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            Admin Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-[var(--ll-text)]">District Updates</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Draft district-standings updates and school milestone celebrations. Every draft here is
            DRAFT only - nothing is posted or sent automatically. Copy what you want to use into
            Announcements or send it however your school prefers.
          </p>
        </div>

        {isPlatformAdmin ? (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-[var(--ll-text)]">Generate a draft</h2>
            <div className="mt-4 flex gap-2">
              {(["standings", "milestone"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDraftKind(k)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    draftKind === k
                      ? "bg-[var(--ll-yellow)] text-[var(--ll-bg)]"
                      : "border border-[var(--ll-border)] text-[var(--ll-text-muted)]"
                  }`}
                >
                  {k === "standings" ? "Standings update" : "Milestone celebration"}
                </button>
              ))}
            </div>

            {draftKind === "standings" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                  Scope
                  <select
                    value={standingsScope}
                    onChange={(e) => {
                      setStandingsScope(e.target.value as typeof standingsScope);
                      setStandingsScopeId("");
                    }}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                  >
                    <option value="district">District</option>
                    <option value="school">School</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                  {standingsScope === "district" ? "District" : "School"}
                  <select
                    value={standingsScopeId}
                    onChange={(e) => setStandingsScopeId(e.target.value)}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                  >
                    <option value="">Select...</option>
                    {standingsScope === "district"
                      ? districts.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))
                      : schools.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                  Period type
                  <select
                    value={periodType}
                    onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly (term)</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                  Scope
                  <select
                    value={milestoneScope}
                    onChange={(e) => {
                      setMilestoneScope(e.target.value as typeof milestoneScope);
                      setMilestoneScopeId("");
                    }}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                  >
                    <option value="school">School</option>
                    <option value="class">Class</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-[var(--ll-text-muted)]">
                  {milestoneScope === "school" ? "School" : "Class"}
                  <select
                    value={milestoneScopeId}
                    onChange={(e) => setMilestoneScopeId(e.target.value)}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                  >
                    <option value="">Select...</option>
                    {(milestoneScope === "school" ? schools : classes).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <button
              type="button"
              disabled={running || !canGenerate}
              onClick={generate}
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--ll-yellow)] px-5 py-2 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-50"
            >
              {running ? "Generating..." : "Generate Draft"}
            </button>
            {runStatus ? <p className="mt-3 text-xs text-[var(--ll-text-muted)]">Result: {runStatus}</p> : null}
          </Card>
        ) : null}

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-[var(--ll-text)]">Recent drafts</h2>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">Loading...</p>
          ) : updates.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">No drafts yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--ll-border)]">
              {updates.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ll-text)]">
                      {u.type === "standings" ? "Standings" : "Milestone"} - {u.scope} ({u.scopeId})
                    </p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      {new Date(u.createdAt).toLocaleString()} - status {u.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void viewUpdate(u.id)}
                    className="inline-flex min-h-11 items-center rounded-xl border border-[var(--ll-border)] px-4 py-2 text-xs font-semibold text-[var(--ll-text)]"
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ll-text)]">
                {selected.type === "standings" ? "Standings" : "Milestone"} draft
              </h2>
              <button type="button" onClick={() => setSelected(null)} className="text-xs font-semibold text-[var(--ll-text-muted)]">
                Close
              </button>
            </div>
            <p className="mt-2 rounded-xl border border-amber-400/20 bg-[var(--ll-yellow-soft)] px-4 py-3 text-xs font-semibold text-[var(--ll-yellow)]">
              DRAFT - review before using anywhere. Nothing here has been sent.
            </p>
            <div className="mt-4 whitespace-pre-wrap text-sm text-[var(--ll-text)]">{selected.draftText}</div>
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--ll-text)]">Underlying data</summary>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-black/20 p-4 text-xs text-[var(--ll-text-muted)]">
                {JSON.stringify(selected.dataSnapshot, null, 2)}
              </pre>
            </details>
            {selected.changesSummary ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--ll-text)]">Detected changes</summary>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-black/20 p-4 text-xs text-[var(--ll-text-muted)]">
                  {JSON.stringify(selected.changesSummary, null, 2)}
                </pre>
              </details>
            ) : null}
          </Card>
        ) : null}
      </div>
    </main>
  );
}
