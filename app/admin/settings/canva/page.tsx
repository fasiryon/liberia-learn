import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasCanvaOAuthClientConfig } from "@/lib/canva/canvaOAuth";
import { CanvaConnectButton, CanvaDisconnectButton } from "./CanvaButtons";

export const dynamic = "force-dynamic";

export default async function CanvaSettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) redirect("/login");
  if (user.role !== "ADMIN") redirect("/admin");

  const isConfigured = hasCanvaOAuthClientConfig();
  const credential = await prisma.canvaOAuthCredential.findUnique({
    where: { provider: "canva" },
    select: { createdAt: true, updatedAt: true, scope: true },
  });

  const connected = !!credential;
  const justConnected = searchParams.connected === "true";
  const errorMsg = searchParams.error;

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/admin"
            className="text-xs text-[var(--ll-yellow)] hover:opacity-80"
          >
            ← Settings
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">
            Canva Integration
          </h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Connect your Canva account to enable AI-assisted design generation for curriculum materials.
          </p>
        </div>

        {justConnected && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            Canva connected successfully.
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {!isConfigured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            Canva OAuth is not configured on this server. Set{" "}
            <code className="font-mono">CANVA_CLIENT_ID</code>,{" "}
            <code className="font-mono">CANVA_CLIENT_SECRET</code>, and{" "}
            <code className="font-mono">CANVA_REDIRECT_URI</code> in your environment variables.
          </div>
        )}

        {/* Status card */}
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {connected ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Canva Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Not Connected
                  </span>
                )}
              </div>
              {connected && credential ? (
                <p className="text-xs text-[var(--ll-text-faint)]">
                  Connected{" "}
                  {credential.updatedAt.toLocaleDateString("en-LR", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {credential.scope ? ` · ${credential.scope.split(" ").length} scopes` : ""}
                </p>
              ) : (
                <p className="text-xs text-[var(--ll-text-faint)]">
                  No Canva account linked. Authorise via OAuth to get started.
                </p>
              )}
            </div>
            <div className="shrink-0">
              {connected ? (
                <CanvaDisconnectButton />
              ) : (
                <CanvaConnectButton disabled={!isConfigured} />
              )}
            </div>
          </div>
        </div>

        {/* Capabilities info */}
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--ll-text)]">What this enables</h2>
          <ul className="space-y-1.5 text-xs text-[var(--ll-text-muted)]">
            {[
              "AI-assisted design creation for lesson covers and worksheets",
              "Export curriculum materials directly to your Canva workspace",
              "Access and reuse school-branded design templates and assets",
              "Generate shareable presentation slides from lesson content",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-[var(--ll-yellow)]">·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
