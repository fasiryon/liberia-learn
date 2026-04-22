"use client";

import { FormEvent, useEffect, useState } from "react";

type PolicyRow = {
  id: string;
  policyKey: string;
  scope: "NATIONAL" | "DISTRICT" | "SCHOOL";
  isActive: boolean;
  config: Record<string, unknown>;
};

type OverrideRow = {
  id: string;
  policyKey: string;
  targetType: string;
  targetId: string | null;
  reason: string;
  expiresAt: string | null;
};

export default function MoePoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    policyKey: "ATTENDANCE_COMPLIANCE",
    scope: "NATIONAL",
    config: '{"maxRetroDays":7}',
  });

  async function load() {
    const [policyRes, overrideRes] = await Promise.all([
      fetch("/api/moe/policies", { cache: "no-store" }),
      fetch("/api/moe/override", { cache: "no-store" }),
    ]);
    const [policyData, overrideData] = await Promise.all([policyRes.json(), overrideRes.json()]);
    if (!policyRes.ok || policyData?.error) {
      throw new Error(policyData?.error ?? "Failed to load policies");
    }
    if (!overrideRes.ok || overrideData?.error) {
      throw new Error(overrideData?.error ?? "Failed to load overrides");
    }
    setPolicies(policyData.policies ?? []);
    setOverrides(overrideData.overrides ?? []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/moe/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyKey: form.policyKey,
          scope: form.scope,
          config: JSON.parse(form.config),
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "Failed to create policy");
      }
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to create policy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--ll-yellow)]">Policy Layer</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">National and District Policies</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--ll-text-muted)]">
          All policy controls are enforced server-side through the shared policy engine. This page manages the active policy set and override history.
        </p>
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-3">
          <input
            value={form.policyKey}
            onChange={(event) => setForm((current) => ({ ...current, policyKey: event.target.value }))}
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          />
          <select
            value={form.scope}
            onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value }))}
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          >
            <option value="NATIONAL">National</option>
            <option value="DISTRICT">District</option>
            <option value="SCHOOL">School</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Policy"}
          </button>
          <textarea
            value={form.config}
            onChange={(event) => setForm((current) => ({ ...current, config: event.target.value }))}
            className="md:col-span-3 min-h-[120px] rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          />
        </form>
        {error ? <p className="mt-3 text-sm text-[var(--ll-danger)]">{error}</p> : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">Active Policies</h2>
          <div className="mt-4 space-y-3">
            {policies.map((policy) => (
              <div key={policy.id} className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[var(--ll-text)]">{policy.policyKey}</p>
                  <span className="text-xs uppercase tracking-wide text-[var(--ll-yellow)]">{policy.scope}</span>
                </div>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-[var(--ll-text-muted)]">
                  {JSON.stringify(policy.config, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">Overrides</h2>
          <div className="mt-4 space-y-3">
            {overrides.map((override) => (
              <div key={override.id} className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[var(--ll-text)]">{override.policyKey}</p>
                  <span className="text-xs uppercase tracking-wide text-[var(--ll-yellow)]">{override.targetType}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--ll-text)]">{override.reason}</p>
                <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                  Target: {override.targetId ?? "global"} {override.expiresAt ? `· Expires ${new Date(override.expiresAt).toLocaleString()}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
