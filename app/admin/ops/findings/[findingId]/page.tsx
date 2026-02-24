/**
 * /admin/ops/findings/[findingId]
 *
 * Finding detail view. Shows:
 *   - Signal metrics (current / baseline / deltaPct)
 *   - Recommended actions + recommended flags
 *   - AI explanation (if generated)
 *   - Action buttons: acknowledge / resolve / generate explanation
 *
 * Escape hatch: ← Back to Findings List.
 * Keyboard-navigable: all interactive elements are focusable.
 *
 * Server component for data; FindingActions for client interactions.
 */

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOpsAiEnabled, getOpsAiMinSeverity, severityMeetsThreshold } from "@/lib/serverFlags";
import { FindingActions } from "./FindingActions";

export const dynamic = "force-dynamic";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "border-red-500 bg-red-500/10 text-red-200",
  warn:     "border-amber-500 bg-amber-500/10 text-amber-200",
  info:     "border-blue-500 bg-blue-500/10 text-blue-200",
};

const STATUS_LABELS: Record<string, string> = {
  open:     "🔴 Open",
  ack:      "🟡 Acknowledged",
  resolved: "🟢 Resolved",
};

type Params = { params: { findingId: string } };

export default async function FindingDetailPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const finding = await prisma.opsFinding.findUnique({
    where: { id: params.findingId },
    include: { explanation: true },
  });

  if (!finding) notFound();

  // Tenant isolation
  if (!user.isPlatformAdmin && finding.schoolId !== user.schoolId) {
    redirect("/admin/ops/findings");
  }

  const aiEnabled = isOpsAiEnabled();
  const minSeverity = getOpsAiMinSeverity();
  const aiAvailableForFinding = aiEnabled && severityMeetsThreshold(finding.severity, minSeverity);

  const actions = Array.isArray(finding.recommendedActions)
    ? (finding.recommendedActions as string[])
    : [];
  const flags = Array.isArray(finding.recommendedFlags)
    ? (finding.recommendedFlags as { flag: string; setValue: string }[])
    : [];

  const severityClass = SEVERITY_COLORS[finding.severity] ?? "border-slate-700 bg-slate-900/60 text-slate-200";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">

        {/* Header + escape hatch */}
        <header>
          <Link
            href="/admin/ops/findings"
            className="text-xs text-slate-400 hover:text-slate-200 mb-3 inline-block focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
            aria-label="Back to findings list"
          >
            ← Back to Findings
          </Link>

          <div className={`rounded-2xl border p-5 ${severityClass}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <code className="text-lg font-mono font-bold">{finding.signalKey}</code>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
                    {finding.severity}
                  </span>
                  <span className="text-xs opacity-60">·</span>
                  <span className="text-xs opacity-80">{finding.category}</span>
                  <span className="text-xs opacity-60">·</span>
                  <span className="text-xs">{STATUS_LABELS[finding.status] ?? finding.status}</span>
                </div>
              </div>
              <span className="text-xs opacity-60 text-right">
                {new Date(finding.createdAt).toLocaleString()}<br />
                {finding.windowHours}h window
              </span>
            </div>
          </div>
        </header>

        {/* Signal metrics */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="text-sm font-semibold text-slate-300 mb-3">
            Signal Metrics
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Current",  value: finding.current  },
              { label: "Baseline", value: finding.baseline },
              { label: "Δ %",     value: finding.deltaPct, isDelta: true },
            ].map(({ label, value, isDelta }) => (
              <div
                key={label}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center"
              >
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-xl font-bold ${isDelta && value != null && value > 0 ? "text-red-300" : isDelta && value != null && value < 0 ? "text-emerald-300" : "text-slate-100"}`}>
                  {value != null
                    ? isDelta
                      ? `${value > 0 ? "+" : ""}${Math.round(value)}%`
                      : finding.signalKey.includes("rate") || finding.category === "sms"
                        ? `${(value * 100).toFixed(1)}%`
                        : value.toFixed(value < 1 ? 2 : 0)
                    : "—"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Recommended actions */}
        {actions.length > 0 && (
          <section aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="text-sm font-semibold text-slate-300 mb-3">
              Recommended Actions
            </h2>
            <ol className="space-y-2">
              {actions.map((action, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-emerald-800 text-emerald-200 text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-200">{action}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Recommended flags (advisory only) */}
        {flags.length > 0 && (
          <section aria-labelledby="flags-heading">
            <h2 id="flags-heading" className="text-sm font-semibold text-slate-300 mb-2">
              Recommended Flag Changes{" "}
              <span className="font-normal text-slate-500 text-xs">(advisory — apply manually)</span>
            </h2>
            <div className="space-y-2">
              {flags.map((f, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
                  <code className="text-xs text-amber-300 flex-1">{f.flag}</code>
                  <span className="text-slate-500 text-xs">→</span>
                  <code className="text-xs text-emerald-300">{f.setValue}</code>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Explanation */}
        {finding.explanation ? (
          <section aria-labelledby="ai-heading">
            <h2 id="ai-heading" className="text-sm font-semibold text-slate-300 mb-3">
              AI Explanation{" "}
              <span className="font-normal text-slate-500 text-xs">
                advisory · {finding.explanation.modelUsed}
              </span>
            </h2>
            <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-5 space-y-4">
              <p className="text-sm text-slate-200">{finding.explanation.summary}</p>

              {(finding.explanation.hypotheses as string[]).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">Hypotheses</p>
                  <ul className="space-y-1">
                    {(finding.explanation.hypotheses as string[]).map((h, i) => (
                      <li key={i} className="text-sm text-slate-300 flex gap-2">
                        <span className="text-slate-500">•</span> {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(finding.explanation.checklist as string[]).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">Investigation Checklist</p>
                  <ol className="space-y-1">
                    {(finding.explanation.checklist as string[]).map((step, i) => (
                      <li key={i} className="text-sm text-slate-300 flex gap-2">
                        <span className="text-slate-500 flex-shrink-0">{i + 1}.</span> {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {(finding.explanation.monitorNext as string[]).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">Monitor Next</p>
                  <ul className="space-y-1">
                    {(finding.explanation.monitorNext as string[]).map((item, i) => (
                      <li key={i} className="text-sm text-slate-300 flex gap-2">
                        <span className="text-slate-500">→</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        ) : (
          aiAvailableForFinding && (
            <section aria-labelledby="ai-cta-heading">
              <h2 id="ai-cta-heading" className="text-sm font-semibold text-slate-300 mb-2">
                AI Explanation
              </h2>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 text-center">
                <p className="text-sm text-slate-400 mb-1">
                  No explanation generated yet.
                </p>
                <p className="text-xs text-slate-500">
                  Use the Generate Explanation button below.
                </p>
              </div>
            </section>
          )
        )}

        {/* Action buttons (client component) */}
        <FindingActions
          findingId={finding.id}
          currentStatus={finding.status}
          aiEnabled={aiAvailableForFinding}
          hasExplanation={!!finding.explanation}
        />
      </div>
    </main>
  );
}
