import { requireRole } from "@/lib/auth";
import UnitOverviewClient from "./UnitOverviewClient";

export const dynamic = "force-dynamic";

export default async function StudentUnitPage({ params }: { params: { unitId: string } }) {
  await requireRole("STUDENT");
  return <UnitOverviewClient unitId={params.unitId} />;
}
