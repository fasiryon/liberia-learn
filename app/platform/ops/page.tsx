import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { UnifiedOpsDashboard } from "@/components/ops/UnifiedOpsDashboard";
import { getOperationalSnapshot } from "@/lib/ops/operationalSnapshot";
import { operationalSourceReaders } from "@/lib/ops/operationalSources";

export const dynamic = "force-dynamic";

export default async function PlatformOpsPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/platform");
  const snapshot = await getOperationalSnapshot({ scope: { kind: "NATIONAL" }, readers: operationalSourceReaders });
  return <UnifiedOpsDashboard snapshot={snapshot} />;
}
