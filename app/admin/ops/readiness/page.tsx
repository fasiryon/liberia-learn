import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { UnifiedOpsDashboard } from "@/components/ops/UnifiedOpsDashboard";
import { getOperationalSnapshot, type OperationalScope } from "@/lib/ops/operationalSnapshot";
import { operationalSourceReaders } from "@/lib/ops/operationalSources";

export const dynamic = "force-dynamic";

export default async function OperationalReadinessPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin && user.role !== "MOE_SUPER_ADMIN") redirect("/");
  const scope: OperationalScope = user.isPlatformAdmin || user.role === "MOE_SUPER_ADMIN"
    ? { kind: "NATIONAL" }
    : user.schoolId ? { kind: "SCHOOL", schoolId: user.schoolId } : (() => { redirect("/"); })();
  const snapshot = await getOperationalSnapshot({ scope, readers: operationalSourceReaders });
  return <div className="mx-auto max-w-7xl p-6"><UnifiedOpsDashboard snapshot={snapshot} /></div>;
}


