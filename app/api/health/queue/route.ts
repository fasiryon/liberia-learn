import { NextResponse } from "next/server";
import { getQueueReadiness } from "@/lib/queueReadiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const sqs = await getQueueReadiness();
  const ok = sqs.configured && sqs.fifoDetected && sqs.sendPermissions && sqs.receiveDeletePermissions;

  return NextResponse.json(
    {
      ok,
      status: ok ? "healthy" : "unavailable",
      code: ok ? "SQS_QUEUE_READY" : "SQS_QUEUE_UNAVAILABLE",
      sqs,
    },
    { status: ok ? 200 : 503 }
  );
}
