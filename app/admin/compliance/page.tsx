/**
 * /admin/compliance — Compliance & Audit Log
 *
 * Server component. Shows a searchable, paginated audit log for the admin's
 * school. Platform admins see entries across all schools.
 *
 * Plain-language UI for low-literacy admins per national usability requirements.
 * All interactive elements are keyboard-navigable.
 * Escape hatch: ← Back to Admin Console link.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AuditLogSearch from "./AuditLogSearch";
import { isGovAuditSearchEnabled, isGovCircuitBreakerTripped } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface Props {
  searchParams?: {
    action?: string;
    resourceType?: string;
    from?: string;
    to?: string;
    page?: string;
    schoolId?: string;
  };
}

export default async function CompliancePage({ searchParams = {} }: Props) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  // ── Feature flags ─────────────────────────────────────────────────────────
  const circuitOpen = isGovCircuitBreakerTripped();
  const auditEnabled = !circuitOpen && isGovAuditSearchEnabled();

  // ── Params ────────────────────────────────────────────────────────────────
  const action = searchParams.action ?? "";
  const resourceType = searchParams.resourceType ?? "";
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const isPlatformAdmin = user.isPlatformAdmin === true;

  // Tenant isolation
  const effectiveSchoolId = isPlatformAdmin
    ? (searchParams.schoolId ?? undefined)
    : (user.schoolId ?? undefined);

  // ── Data fetch ────────────────────────────────────────────────────────────
  const where: Record<string, unknown> = auditEnabled
    ? {
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
        ...(action ? { action: { contains: action } } : {}),
        ...(resourceType ? { resourceType } : {}),
        ...((from || to)
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      }
    : { id: "disabled" }; // empty result when disabled

  const [total, entries, recentExports] = await Promise.all([
    auditEnabled ? prisma.auditLog.count({ where }) : Promise.resolve(0),
    auditEnabled
      ? prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            createdAt: true,
            action: true,
            userId: true,
            resourceType: true,
            resourceId: true,
            schoolId: true,
            traceId: true,
          },
        })
      : Promise.resolve([]),
    prisma.exportRecord.findMany({
      where: effectiveSchoolId ? { scopeId: effectiveSchoolId } : {},
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        exportType: true,
        scope: true,
        format: true,
        userId: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className="mb-6 flex items-center gap-4">
          <Link
            href="/admin"
            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Back to Admin Console"
          >
            ← Back
          </Link>
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-300 mb-0.5">
              Compliance
            </p>
            <h1 className="text-2xl font-bold">Audit Log</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              All important actions taken in your school are recorded here.
            </p>
          </div>
        </header>

        {/* ── Circuit breaker notice ─────────────────────────────────────── */}
        {circuitOpen && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-700/40 bg-red-900/20 p-4 text-sm text-red-300"
          >
            Governance features are temporarily disabled by the system administrator.
            Please contact support.
          </div>
        )}

        {/* ── Search form ────────────────────────────────────────────────── */}
        {auditEnabled && (
          <AuditLogSearch
            currentAction={action}
            currentFrom={from}
            currentTo={to}
            currentResourceType={resourceType}
            schoolId={effectiveSchoolId ?? null}
            isPlatformAdmin={isPlatformAdmin}
          />
        )}

        {/* ── Results table ──────────────────────────────────────────────── */}
        {auditEnabled && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">
                Records{" "}
                <span className="text-slate-400 font-normal text-sm">
                  ({total.toLocaleString()} total)
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                      When
                    </th>
                    <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                      Action
                    </th>
                    <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                      Record Type
                    </th>
                    <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                      Record ID
                    </th>
                    {isPlatformAdmin && (
                      <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                        School
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && (
                    <tr>
                      <td
                        colSpan={isPlatformAdmin ? 5 : 4}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No records found for these filters.
                      </td>
                    </tr>
                  )}
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30"
                    >
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-200">
                        {e.action}
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {e.resourceType ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">
                        {e.resourceId ? e.resourceId.slice(0, 12) + "…" : "—"}
                      </td>
                      {isPlatformAdmin && (
                        <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">
                          {e.schoolId ?? "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="Audit log pages"
                className="mt-3 flex gap-2 justify-end"
              >
                {page > 1 && (
                  <Link
                    href={`/admin/compliance?${new URLSearchParams({
                      ...(action ? { action } : {}),
                      ...(resourceType ? { resourceType } : {}),
                      ...(from ? { from } : {}),
                      ...(to ? { to } : {}),
                      page: String(page - 1),
                    }).toString()}`}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/compliance?${new URLSearchParams({
                      ...(action ? { action } : {}),
                      ...(resourceType ? { resourceType } : {}),
                      ...(from ? { from } : {}),
                      ...(to ? { to } : {}),
                      page: String(page + 1),
                    }).toString()}`}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    Next →
                  </Link>
                )}
              </nav>
            )}
          </section>
        )}

        {/* ── Recent export history ──────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold mb-3">Recent Downloads</h2>
          <p className="text-xs text-slate-400 mb-3">
            Every data download is recorded below for your records.
          </p>
          {recentExports.length === 0 ? (
            <p className="text-sm text-slate-500">No downloads yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                      When
                    </th>
                    <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                      Type
                    </th>
                    <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                      Scope
                    </th>
                    <th className="px-3 py-2.5 text-left text-slate-400 font-medium">
                      Format
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentExports.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30"
                    >
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {r.exportType.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{r.scope}</td>
                      <td className="px-3 py-2 text-slate-500 uppercase">
                        {r.format ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4">
            <Link
              href="/admin/governance/exports"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              Go to Data Downloads →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
