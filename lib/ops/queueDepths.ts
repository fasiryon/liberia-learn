import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";
import { prisma } from "@/lib/db";

export type QueueSnapshot = {
  mainQueue: { depth: number | null; configured: boolean };
  dlq: { depth: number | null; configured: boolean };
  regenRunsActive: number;
  note: string;
};

async function getSqsDepth(queueUrl: string): Promise<number | null> {
  if (!queueUrl) return null;
  try {
    const client = new SQSClient({
      region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
    });
    const res = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages"],
      })
    );
    const raw = res.Attributes?.ApproximateNumberOfMessages;
    return typeof raw === "string" ? parseInt(raw, 10) || 0 : null;
  } catch {
    return null;
  }
}

export async function getQueueDepths(): Promise<QueueSnapshot> {
  const mainUrl = process.env.SQS_QUEUE_URL?.trim() ?? "";
  const dlqUrl = process.env.SQS_DLQ_URL?.trim() ?? "";

  const [mainDepth, dlqDepth, regenRunsActive] = await Promise.all([
    getSqsDepth(mainUrl),
    getSqsDepth(dlqUrl),
    prisma.curriculumRegenerationRun
      .count({ where: { status: "running" } })
      .catch(() => 0),
  ]);

  return {
    mainQueue: { depth: mainDepth, configured: mainUrl.length > 0 },
    dlq: { depth: dlqDepth, configured: dlqUrl.length > 0 },
    regenRunsActive,
    note: "Client-side offline queue (NR-14A) is not visible to the server — that number is always 0 here.",
  };
}
