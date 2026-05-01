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

type DirectiveRow = {
  id: string;
  title: string;
  description: string;
  policyType: string;
  targetScope: string;
  targetFilters: Record<string, unknown>;
  status: string;
  publishedAt: string | null;
  appliedAt: string | null;
  createdBy?: { name: string | null } | null;
  approvedBy?: { name: string | null } | null;
  applicationSummary?: { total: number; applied: number; pending: number; failed: number; needsReview: number };
};

export default function MoePoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [directives, setDirectives] = useState<DirectiveRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    policyKey: "ATTENDANCE_COMPLIANCE",
    scope: "NATIONAL",
    config: '{"maxRetroDays":7}',
  });
  const [directiveForm, setDirectiveForm] = useState({
    title: "",
    description: "",
    policyType: "curriculum_directive",
    targetScope: "national",
    targetFilters: "{}",
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
    setDirectives(policyData.directives ?? []);
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

  async function handleCreateDirective(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/moe/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: directiveForm.title,
          description: directiveForm.description,
          policyType: directiveForm.policyType,
          targetScope: directiveForm.targetScope,
          targetFilters: JSON.parse(directiveForm.targetFilters || "{}"),
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Failed to create directive");
      setDirectiveForm((current) => ({ ...current, title: "", description: "", targetFilters: "{}" }));
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to create directive");
    } finally {
      setSaving(false);
    }
  }

  async function transitionDirective(id: string, status: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/moe/policies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Failed to update directive");
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to update directive");
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
        <h2 className="text-lg font-semibold text-[var(--ll-text)]">Policy Directives</h2>
        <form onSubmit={handleCreateDirective} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={directiveForm.title}
            onChange={(event) => setDirectiveForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Directive title"
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          />
          <input
            value={directiveForm.policyType}
            onChange={(event) => setDirectiveForm((current) => ({ ...current, policyType: event.target.value }))}
            placeholder="Policy type"
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          />
          <select
            value={directiveForm.targetScope}
            onChange={(event) => setDirectiveForm((current) => ({ ...current, targetScope: event.target.value }))}
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          >
            <option value="national">National</option>
            <option value="county">County</option>
            <option value="district">District</option>
            <option value="school">School</option>
            <option value="grade">Grade</option>
            <option value="subject">Subject</option>
          </select>
          <textarea
            value={directiveForm.targetFilters}
            onChange={(event) => setDirectiveForm((current) => ({ ...current, targetFilters: event.target.value }))}
            className="min-h-[72px] rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          />
          <textarea
            value={directiveForm.description}
            onChange={(event) => setDirectiveForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Directive description"
            className="md:col-span-2 min-h-[88px] rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
          >
            Save Draft Directive
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <div className="grid gap-3">
          {directives.map((directive) => (
            <div key={directive.id} className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--ll-text)]">{directive.title}</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                    {directive.policyType} - {directive.targetScope} - {directive.status}
                  </p>
                  <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{directive.description}</p>
                </div>
                <div className="text-right text-xs text-[var(--ll-text-faint)]">
                  <p>Approved by {directive.approvedBy?.name ?? "not approved"}</p>
                  <p>{directive.applicationSummary?.needsReview ?? 0} need review</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {directive.status === "draft" ? <button type="button" onClick={() => transitionDirective(directive.id, "pending_review")} className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text)]">Submit</button> : null}
                {directive.status === "pending_review" ? <button type="button" onClick={() => transitionDirective(directive.id, "approved")} className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-[var(--ll-yellow)]">Approve</button> : null}
                {directive.status === "pending_review" ? <button type="button" onClick={() => transitionDirective(directive.id, "rejected")} className="rounded-full border border-red-400/30 px-3 py-1 text-xs text-[var(--ll-danger)]">Reject</button> : null}
                {directive.status === "approved" ? <button type="button" onClick={() => transitionDirective(directive.id, "published")} className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-[var(--ll-yellow)]">Publish</button> : null}
                {directive.status === "published" ? <button type="button" onClick={() => transitionDirective(directive.id, "applied")} className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text)]">Mark Review Needed</button> : null}
                {directive.status !== "archived" ? <button type="button" onClick={() => transitionDirective(directive.id, "archived")} className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-[var(--ll-yellow)]">Archive</button> : null}
              </div>
            </div>
          ))}
        </div>
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
