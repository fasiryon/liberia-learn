"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Tab = "agents" | "cost" | "goals" | "escalations" | "triggers";
const TABS: { id: Tab; label: string }[] = [
  { id: "agents", label: "Agents" },
  { id: "cost", label: "Cost" },
  { id: "goals", label: "Goals" },
  { id: "escalations", label: "Escalations" },
  { id: "triggers", label: "Triggers" },
];

async function getJSON(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? r.statusText);
  return r.json();
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">{children}</div>;
}

function AgentsPanel() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    getJSON("/api/admin/agents").then((d) => setRows(d.agents)).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => load(), [load]);
  async function toggle(name: string, enabled: boolean | null) {
    await fetch(`/api/admin/agents/${name}/toggle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  }
  if (err) return <p className="text-sm text-red-400">{err}</p>;
  return (
    <div className="space-y-2">
      {rows.map((a) => {
        const name = a.name as string;
        const eff = a.effectiveEnabled as boolean;
        return (
          <Card key={name}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-100">
                  {name} <span className="text-xs text-slate-500">v{String(a.version)}</span>{" "}
                  <span className={`ml-2 rounded px-2 py-0.5 text-xs ${eff ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                    {eff ? "ON" : "OFF"}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{String(a.description)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {String(a.invocationCount)} invocations · ${Number(a.costThisWeekUSD).toFixed(4)} this week ·
                  flag {a.envEnabled ? "on" : "off"} · override {a.override === null ? "—" : String(a.override)}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => toggle(name, true)} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">On</button>
                <button onClick={() => toggle(name, false)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Off</button>
                <button onClick={() => toggle(name, null)} className="rounded bg-slate-600 px-2 py-1 text-xs text-white">Env</button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function CostPanel() {
  const [d, setD] = useState<{ perAgent: Record<string, unknown>[]; topUsers: Record<string, unknown>[] } | null>(null);
  useEffect(() => { getJSON("/api/admin/agents/cost").then(setD).catch(() => setD(null)); }, []);
  if (!d) return <p className="text-sm text-slate-400">Loading…</p>;
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Per-agent cost (USD)</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Agent</th><th>Day</th><th>Week</th><th>Month</th><th>Inv</th></tr></thead>
          <tbody>{d.perAgent.map((a) => (
            <tr key={String(a.agentName)} className="border-t border-slate-800">
              <td className="py-1">{String(a.agentName)}</td>
              <td className="font-mono">{Number(a.dailyUSD).toFixed(4)}</td>
              <td className="font-mono">{Number(a.weeklyUSD).toFixed(4)}</td>
              <td className="font-mono">{Number(a.monthlyUSD).toFixed(4)}</td>
              <td>{String(a.invocations)}</td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Highest-cost users (30d)</h3>
        {d.topUsers.length === 0 ? <p className="text-xs text-slate-500">None</p> : d.topUsers.map((u) => (
          <div key={String(u.userId)} className="flex justify-between text-sm"><span className="text-slate-400">{String(u.userId)}</span><span className="font-mono">${Number(u.costUSD).toFixed(4)}</span></div>
        ))}
      </Card>
    </div>
  );
}

function GoalsPanel() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { getJSON("/api/admin/agents/goals").then((d) => setRows(d.goals)).catch(() => setRows([])); }, []);
  return (
    <div className="space-y-2">
      {rows.length === 0 ? <p className="text-sm text-slate-400">No open goals.</p> : rows.map((g) => (
        <Card key={String(g.id)}>
          <div className="flex justify-between">
            <div>
              <div className="text-sm text-slate-100">{String(g.goalDescription)}</div>
              <div className="text-xs text-slate-500">{String(g.agentName)} · step {String(g.stepCount)} {g.pauseReason ? `· ${String(g.pauseReason)}` : ""}</div>
            </div>
            <span className="text-xs text-amber-400">{String(g.status)}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EscalationsPanel() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const load = useCallback(() => { getJSON("/api/admin/agents/escalations").then((d) => setRows(d.escalations)).catch(() => setRows([])); }, []);
  useEffect(() => load(), [load]);
  async function act(id: string, action: string, extra: Record<string, unknown>) {
    await fetch(`/api/admin/agents/escalations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    load();
  }
  return (
    <div className="space-y-2">
      {rows.length === 0 ? <p className="text-sm text-slate-400">No pending escalations.</p> : rows.map((e) => (
        <Card key={String(e.id)}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-100">{String(e.reason)} <span className="ml-2 text-xs text-red-400">{String(e.priority)}</span></div>
              <div className="text-xs text-slate-500">{String(e.agentName)} · inv {String(e.invocationId)} · {String(e.status)}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => act(String(e.id), "assign", {})} className="rounded bg-slate-600 px-2 py-1 text-xs text-white">Assign me</button>
              <button onClick={() => act(String(e.id), "resolve", { resolution: prompt("Resolution?") ?? "resolved" })} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Resolve</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TriggersPanel() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { getJSON("/api/admin/agents/triggers").then((d) => setRows(d.triggers)).catch(() => setRows([])); }, []);
  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Event-triggered runs (30d)</h3>
      {rows.length === 0 ? <p className="text-xs text-slate-500">No event-triggered runs yet.</p> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Agent</th><th>Runs</th><th>Success</th><th>Rate</th></tr></thead>
          <tbody>{rows.map((t) => (
            <tr key={String(t.agentName)} className="border-t border-slate-800">
              <td className="py-1">{String(t.agentName)}</td><td>{String(t.total)}</td><td>{String(t.success)}</td>
              <td>{Math.round(Number(t.successRate) * 100)}%</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Card>
  );
}

export default function AgentsDashboardPage() {
  const [tab, setTab] = useState<Tab>("agents");
  return (
    <div className="mx-auto max-w-5xl p-6 text-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Agent Platform</h1>
        <Link href="/admin/agents/invocations" className="text-sm text-emerald-400 hover:underline">Invocation log →</Link>
      </div>
      <div className="mb-5 flex gap-1 border-b border-slate-700">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm ${tab === t.id ? "border-b-2 border-emerald-400 text-slate-100" : "text-slate-400"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "agents" && <AgentsPanel />}
      {tab === "cost" && <CostPanel />}
      {tab === "goals" && <GoalsPanel />}
      {tab === "escalations" && <EscalationsPanel />}
      {tab === "triggers" && <TriggersPanel />}
    </div>
  );
}
