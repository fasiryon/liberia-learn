import { requireRole } from "@/lib/auth";
import GuardianSettingsClient from "@/app/guardian/settings/GuardianSettingsClient";

export const dynamic = "force-dynamic";

export default async function GuardianSettingsPage() {
  await requireRole("GUARDIAN");
  return <GuardianSettingsClient />;
}
