import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { GenerateTokenButton, SelfDemoteButton } from "./SecurityActions";

export const dynamic = "force-dynamic";

export default async function PlatformSecurityPage() {
  let user = null;
  try {
    user = await requireMoePlatformAdmin();
  } catch (err: any) {
    if (err?.status === 404) notFound();
    redirect("/login");
  }

  const platformAdmins = await prisma.user.findMany({
    where: { isPlatformAdmin: true },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const pendingTokens = await prisma.platformTransferToken.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform Security</h1>
        <p className="text-sm text-[var(--ll-text-muted)] mt-1">
          Manage platform admin access and transfer ownership.
        </p>
      </div>

      {/* Current Platform Admins */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <h2 className="text-lg font-semibold mb-4">Current Platform Admins</h2>
        <div className="space-y-2">
          {platformAdmins.map((admin) => (
            <div key={admin.id} className="flex items-center gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3">
              <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center text-[var(--ll-text)] text-xs font-bold">
                {(admin.name ?? admin.email)?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--ll-text)]">{admin.name ?? "Unnamed"}</p>
                <p className="text-xs text-[var(--ll-text-muted)]">{admin.email}</p>
              </div>
              {admin.id === user.id && (
                <span className="ml-auto rounded-full bg-violet-500/20 text-violet-300 px-2.5 py-0.5 text-[10px]">
                  You
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Generate Transfer Token */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <h2 className="text-lg font-semibold mb-2">Transfer Admin Access</h2>
        <p className="text-xs text-[var(--ll-text-muted)] mb-4">
          Generate a one-time token to promote another user to platform admin. Token expires in 24 hours.
        </p>
        <GenerateTokenButton />
      </section>

      {/* Pending Transfers */}
      {pendingTokens.length > 0 && (
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h2 className="text-lg font-semibold mb-4">Pending Transfer Tokens</h2>
          <div className="space-y-2">
            {pendingTokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3">
                <div>
                  <p className="text-xs font-mono text-[var(--ll-text)]">{t.token.slice(0, 12)}...</p>
                  <p className="text-[10px] text-[var(--ll-text-faint)]">
                    Expires {new Date(t.expiresAt).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)] px-2.5 py-0.5 text-[10px]">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Self-Demote */}
      <section className="rounded-xl border border-red-500/20 bg-[var(--ll-bg)]/70 p-6">
        <h2 className="text-lg font-semibold mb-2 text-red-400">Danger Zone</h2>
        <p className="text-xs text-[var(--ll-text-muted)] mb-4">
          Remove your own platform admin access. Requires at least 2 platform admins to prevent lockout.
        </p>
        <SelfDemoteButton adminCount={platformAdmins.length} />
      </section>
    </div>
  );
}
