import UnitOverviewClient from "./UnitOverviewClient";

export default function StudentUnitPage({ params }: { params: { unitId: string } }) {
  return <UnitOverviewClient unitId={params.unitId} />;
}
