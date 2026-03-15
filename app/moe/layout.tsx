// app/moe/layout.tsx
// Layout for all /moe/* pages.
// MOE portal operates at national scope — no school context, no tenant switcher.
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getMoePortalAllowlist, isMoePortalEnabled } from "@/lib/serverFlags";
import MoeShell from "./MoeShell";

export const metadata: Metadata = {
  title: "MOE Portal – LiberiaLearn",
  description: "Ministry of Education – National Education Platform",
};

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function isAllowlisted(email: string, allowlist: string[]) {
  if (allowlist.length === 0) return true;
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return allowlist.some((entry) => {
    const item = entry.trim().toLowerCase();
    if (!item) return false;
    if (item.includes("@")) return normalized === item;
    const domain = item.startsWith("@") ? item.slice(1) : item;
    return normalized.endsWith(`@${domain}`);
  });
}

export default async function MoeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isMoePortalEnabled()) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const user = session?.user as {
    role?: string;
    name?: string | null;
    email?: string | null;
    isPlatformAdmin?: boolean;
  } | null;

  // No session — render children directly so /moe/login can display
  if (!user?.role) {
    return <>{children}</>;
  }

  const isMoeUser = user.role === "MOE_OFFICIAL" || user.isPlatformAdmin === true;
  const allowlist = getMoePortalAllowlist();

  if (!isMoeUser || !isAllowlisted(user.email ?? "", allowlist)) {
    return <>{children}</>;
  }

  return (
    <MoeShell user={{ name: user.name, email: user.email }}>
      {children}
    </MoeShell>
  );
}