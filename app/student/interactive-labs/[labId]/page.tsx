import { InteractiveLabPlayer } from "@/components/interactive-labs/v2/InteractiveLabPlayer";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
export default function InteractiveLabPage({ params }: { params: { labId: string } }) {
  const definition = getInteractiveLabDefinition(params.labId);
  if (!definition || definition.reviewState !== "APPROVED" || definition.approvalState !== "APPROVED") {
    return <main className="min-h-screen bg-slate-900 px-4 py-8 text-white">This lab is not available.</main>;
  }
  return <main className="min-h-screen bg-slate-900 px-4 py-8"><InteractiveLabPlayer labId={params.labId}/></main>;
}
