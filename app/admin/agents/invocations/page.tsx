"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type Invocation = {
  id: string;
  agentName: string;
  agentVersion: string;
  userId: string | null;
  triggeredBy: string;
  status: string;
  input: unknown;
  output: unknown;
  toolCalls: unknown[];
  llmTokensIn: number;
  llmTokensOut: number;
  llmCostUSD: number;
  toolCostUnits: number;
  latencyMs: number;
  errorMessage: string | null;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  FAILURE: "bg-red-500/20 text-red-400 border-red-500/30",
  ESCALATED: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  TIMEOUT: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  COST_CAPPED: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  FEATURE_DISABLED: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-500/15 text-slate-400 border-slate-500/25";
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function EchoRunner({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("hello harness");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/agents/echo/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? res.statusText);
      setResult(json);
      onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">
        Echo agent — test invocation
      </h2>
      <p className="mb-3 text-xs text-slate-400">
        Admin-only harness check. Requires <code>AGENT_ECHO_ENABLED=true</code>;
        otherwise the run is logged as <code>FEATURE_DISABLED</code>.
      </p>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
          placeholder="Text to echo"
        />
        <button
          onClick={run}
          disabled={running}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      {result ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-300">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export default function AgentInvocationsPage() {
  const [rows, setRows] = useState<Invocation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (agentName) params.set("agentName", agentName);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/agents/invocations?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? res.statusText);
      setRows(json.invocations ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [agentName, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl p-6 text-slate-100">
      <h1 className="mb-1 text-xl font-bold">Agent Platform — Invocations</h1>
      <p className="mb-5 text-sm text-slate-400">
        Every agent run is logged here with its tool calls and cost.
      </p>

      <EchoRunner onDone={load} />

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          placeholder="Filter by agent name"
          className="rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {Object.keys(STATUS_STYLES).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="ml-auto self-center text-xs text-slate-400">
          {total} total
        </span>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No invocations yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tools</th>
                <th className="px-3 py-2">Tokens</th>
                <th className="px-3 py-2">Cost USD</th>
                <th className="px-3 py-2">ms</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="cursor-pointer border-t border-slate-800 hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2 text-slate-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {r.agentName}{" "}
                      <span className="text-slate-500">v{r.agentVersion}</span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2">{r.toolCalls?.length ?? 0}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {r.llmTokensIn}/{r.llmTokensOut}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {r.llmCostUSD.toFixed(6)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{r.latencyMs}</td>
                  </tr>
                  {expanded === r.id ? (
                    <tr className="border-t border-slate-800 bg-slate-900/60">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <DetailBlock label="Input" value={r.input} />
                          <DetailBlock label="Output" value={r.output} />
                          <DetailBlock label="Tool calls" value={r.toolCalls} />
                          {r.errorMessage ? (
                            <DetailBlock label="Error" value={r.errorMessage} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase text-slate-400">
        {label}
      </div>
      <pre className="max-h-48 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-300">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
