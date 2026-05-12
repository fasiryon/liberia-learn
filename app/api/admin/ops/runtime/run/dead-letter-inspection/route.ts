import { handleManualRuntimeRun } from "@/app/api/admin/ops/runtime/run/_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handleManualRuntimeRun(req, "dead-letter-inspection");
}
