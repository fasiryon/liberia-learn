import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AuditLogSearch from "./AuditLogSearch";
import { isGovAuditSearchEnabled, isGovCircuitBreakerTripped } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface Props {
  searchParams?: {
    action?: string;
    actorEmail?: string;
    role?: string;
    resourceType?: string;
    from?: string;
    to?: string;
    page?: string;
    schoolId?: string;
  };
}

export default async function CompliancePage({ searchParams = {} }: Props) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) redirect("/");

  const circuitOpen = isGovCircuitBreakerTripped();
  const auditEnabled = !circuitOpen && isGovAuditSearchEnabled();

  const action = searchParams.action ?? "";
  const actorEmail = searchParams.actorEmail ?? "";
  const role = searchParams.role ?? "";
  const resourceType = searchParams.resourceType ?? "";
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const isPlatformAdmin = user.isPlatformAdmin === true;

  const effectiveSchoolId = isPlatformAdmin
    ? (searchParams.schoolId ?? undefined)
    : (user.schoolId ?? undefined);

  const where: Record<string, unknown> = auditEnabled
    ? {
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
        ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
        ...(resourceType ? { resourceType } : {}),
        ...((actorEmail || role)
          ? {
              user: {
                ...(actorEmail ? { email: { contains: actorEmail, mode: "insensitive" } } : {}),
                ...(role ? { role } : {}),
              },
            }
          : {}),
        ...((from || to)
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      }
    : { id: "disabled" };

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
            ipAddress: true,
            user: {
              select: {
                email: true,
                role: true,
              },
            },
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
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex items-center gap-4">
          <Link
            href="/admin"
            className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs hover:bg-[var(--ll-bg)] focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Back to Admin Console"
          >
            Back
          </Link>
          <div>
            <p className="mb-0.5 text-xs uppercase tracking-wide text-[var(--ll-yellow)]">Compliance</p>
            <h1 className="text-2xl font-bold">Audit Log</h1>
            <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">
              All important actions taken in your school are recorded here.
            </p>
          </div>
        </header>

        {circuitOpen ? (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-700/40 bg-red-900/20 p-4 text-sm text-red-300"
          >
            Governance features are temporarily disabled by the system administrator.
            Please contact support.
          </div>
        ) : null}

        {auditEnabled ? (
          <AuditLogSearch
            currentAction={action}
            currentActorEmail={actorEmail}
            currentRole={role}
            currentFrom={from}
            currentTo={to}
            currentResourceType={resourceType}
            schoolId={effectiveSchoolId ?? null}
            isPlatformAdmin={isPlatformAdmin}
          />
        ) : null}

        {auditEnabled ? (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Records{" "}
                <span className="text-sm font-normal text-[var(--ll-text-muted)]">
                  ({total.toLocaleString()} total)
                </span>
              </h2>
              <p className="text-xs text-[var(--ll-text-faint)]">
                Page {page} of {totalPages}
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--ll-border)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] bg-[var(--ll-bg)]/60">
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">When</th>
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">Actor</th>
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">Role</th>
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">Action</th>
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">
                      Record Type
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">
                      Record ID
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">IP</th>
                    {isPlatformAdmin ? (
                      <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">
                        School
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isPlatformAdmin ? 8 : 7}
                        className="px-3 py-6 text-center text-[var(--ll-text-faint)]"
                      >
                        No records found for these filters.
                      </td>
                    </tr>
                  ) : null}
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-[var(--ll-border)]/50 hover:bg-[var(--ll-surface)]/30"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-[var(--ll-text-muted)]">
                        {new Date(entry.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 text-[var(--ll-text)]">
                        {entry.user?.email ?? "Unknown"}
                      </td>
                      <td className="px-3 py-2 text-[var(--ll-text-muted)]">
                        {entry.user?.role ?? "-"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[var(--ll-text)]">{entry.action}</td>
                      <td className="px-3 py-2 text-[var(--ll-text-muted)]">{entry.resourceType ?? "-"}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-[var(--ll-text-faint)]">
                        {entry.resourceId ? `${entry.resourceId.slice(0, 12)}...` : "-"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-[var(--ll-text-faint)]">
                        {entry.ipAddress ?? "-"}
                      </td>
                      {isPlatformAdmin ? (
                        <td className="px-3 py-2 font-mono text-[10px] text-[var(--ll-text-faint)]">
                          {entry.schoolId ?? "-"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <nav aria-label="Audit log pages" className="mt-3 flex justify-end gap-2">
                {page > 1 ? (
                  <Link
                    href={`/admin/compliance?${new URLSearchParams({
                      ...(action ? { action } : {}),
                      ...(actorEmail ? { actorEmail } : {}),
                      ...(role ? { role } : {}),
                      ...(resourceType ? { resourceType } : {}),
                      ...(from ? { from } : {}),
                      ...(to ? { to } : {}),
                      ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                      page: String(page - 1),
                    }).toString()}`}
                    className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs hover:bg-[var(--ll-surface)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={`/admin/compliance?${new URLSearchParams({
                      ...(action ? { action } : {}),
                      ...(actorEmail ? { actorEmail } : {}),
                      ...(role ? { role } : {}),
                      ...(resourceType ? { resourceType } : {}),
                      ...(from ? { from } : {}),
                      ...(to ? { to } : {}),
                      ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                      page: String(page + 1),
                    }).toString()}`}
                    className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs hover:bg-[var(--ll-surface)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    Next
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-base font-semibold">Recent Downloads</h2>
          <p className="mb-3 text-xs text-[var(--ll-text-muted)]">
            Every data download is recorded below for your records.
          </p>
          {recentExports.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-faint)]">No downloads yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--ll-border)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] bg-[var(--ll-bg)]/60">
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">When</th>
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">Type</th>
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">Scope</th>
                    <th className="px-3 py-2.5 text-left font-medium text-[var(--ll-text-muted)]">Format</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExports.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-[var(--ll-border)]/50 hover:bg-[var(--ll-surface)]/30"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-[var(--ll-text-muted)]">
                        {new Date(record.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2 text-[var(--ll-text)]">
                        {record.exportType.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 text-[var(--ll-text-muted)]">{record.scope}</td>
                      <td className="px-3 py-2 uppercase text-[var(--ll-text-faint)]">
                        {record.format ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex gap-4">
            <Link
              href="/admin/governance/exports"
              className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow)] focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              Go to Data Downloads
            </Link>
            {isPlatformAdmin ? (
              <Link
                href="/admin/governance"
                className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface)] focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Governance Dashboard
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
