import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";
import { prisma } from "@/lib/db";

export type QueueSnapshot = {
  observedAt: string;
  mainQueue: { depth: number | null; processing: number | null; delayed: number | null; configured: boolean };
  dlq: { depth: number | null; configured: boolean };
  regenRunsActive: number;
  note: string;
};

async function getSqsState(queueUrl: string): Promise<{ depth: number | null; processing: number | null; delayed: number | null }> {
  if (!queueUrl) return { depth: null, processing: null, delayed: null };
  try {
    const client = new SQSClient({
      region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
    });
    const res = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible", "ApproximateNumberOfMessagesDelayed"],
      })
    );
    const parse = (value: string | undefined) => typeof value === "string" ? parseInt(value, 10) || 0 : null;
    return { depth: parse(res.Attributes?.ApproximateNumberOfMessages), processing: parse(res.Attributes?.ApproximateNumberOfMessagesNotVisible), delayed: parse(res.Attributes?.ApproximateNumberOfMessagesDelayed) };
  } catch {
    return { depth: null, processing: null, delayed: null };
  }
}

export async function getQueueDepths(): Promise<QueueSnapshot> {
  const mainUrl = process.env.SQS_QUEUE_URL?.trim() ?? "";
  const dlqUrl = process.env.SQS_DLQ_URL?.trim() ?? "";

  const [mainState, dlqState, regenRunsActive] = await Promise.all([
    getSqsState(mainUrl),
    getSqsState(dlqUrl),
    prisma.curriculumRegenerationRun
      .count({ where: { status: "running" } })
      .catch(() => 0),
  ]);

  return {
    observedAt: new Date().toISOString(),
    mainQueue: { ...mainState, configured: mainUrl.length > 0 },
    dlq: { depth: dlqState.depth, configured: dlqUrl.length > 0 },
    regenRunsActive,
    note: "Client-side offline queue (NR-14A) is not visible to the server, so this source never reports it as zero.",
  };
}
