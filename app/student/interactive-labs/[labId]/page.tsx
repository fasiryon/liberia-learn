import { InteractiveLabPlayer } from "@/components/interactive-labs/v2/InteractiveLabPlayer";
export default function InteractiveLabPage({ params }: { params: { labId: string } }) { return <main className="min-h-screen bg-slate-900 px-4 py-8"><InteractiveLabPlayer labId={params.labId}/></main>; }
