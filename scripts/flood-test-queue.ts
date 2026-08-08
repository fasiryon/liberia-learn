// Flood test: sends exactly 200 HEALTH_CHECK messages and measures queue drain.
// 200 matches the literal NR-2 flood test being re-run, not P1-D's higher-load
// variant; see project session notes for why this count was chosen deliberately.
// Run OUTSIDE school hours (not Mon-Fri 08:00-15:00 GMT).
// Usage: npx dotenv -e .env.production -- npx tsx scripts/flood-test-queue.ts
//   or with local AWS credentials: npx tsx scripts/flood-test-queue.ts

import {
  GetQueueAttributesCommand,
  SendMessageBatchCommand,
  SQSClient,
  type GetQueueAttributesCommandOutput,
  type SendMessageBatchCommandOutput,
} from "@aws-sdk/client-sqs";

const QUEUE_URL =
  process.env.SQS_QUEUE_URL ||
  "https://sqs.us-east-1.amazonaws.com/466568847266/liberialearn-jobs.fifo";
const BATCH_SIZE = 10;
export const TOTAL = 200;
const POLL_INTERVAL_MS = 5_000;
const DRAIN_TIMEOUT_MS = 15 * 60_000;

const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });

export type SqsSender = {
  send(command: unknown): Promise<unknown>;
};

export type QueueDepth = {
  visible: number;
  inFlight: number;
  delayed: number;
  total: number;
};

export type FloodTestResult = {
  runId: string;
  totalMessages: number;
  startedAt: string;
  enqueueFinishedAt: string;
  drainedAt: string;
  enqueueDurationMs: number;
  drainAfterEnqueueMs: number;
  totalElapsedMs: number;
  peakVisible: number;
  peakInFlight: number;
};

type FloodTestOptions = {
  client?: SqsSender;
  queueUrl?: string;
  total?: number;
  pollIntervalMs?: number;
  drainTimeoutMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  onDepth?: (depth: QueueDepth) => void;
};

function asCount(value: string | undefined) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function readQueueDepth(attributes?: Record<string, string>): QueueDepth {
  const visible = asCount(attributes?.ApproximateNumberOfMessages);
  const inFlight = asCount(attributes?.ApproximateNumberOfMessagesNotVisible);
  const delayed = asCount(attributes?.ApproximateNumberOfMessagesDelayed);
  return { visible, inFlight, delayed, total: visible + inFlight + delayed };
}

async function getQueueDepth(client: SqsSender, queueUrl: string) {
  const response = (await client.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [
        "ApproximateNumberOfMessages",
        "ApproximateNumberOfMessagesNotVisible",
        "ApproximateNumberOfMessagesDelayed",
      ],
    })
  )) as GetQueueAttributesCommandOutput;
  return readQueueDepth(response.Attributes);
}

export function buildBatchEntries(start: number, count: number, runId: string) {
  return Array.from({ length: count }, (_, offset) => {
    const seq = start + offset;
    return {
      Id: `msg-${seq}`,
      MessageBody: JSON.stringify({
        jobType: "HEALTH_CHECK",
        payload: { seq, runId, ts: Date.now() },
        enqueuedAt: new Date().toISOString(),
      }),
      // Separate groups let FIFO consumers process the flood concurrently.
      MessageGroupId: `p1d-${runId}-${seq}`,
      MessageDeduplicationId: `p1d-${runId}-${seq}`,
    };
  });
}

export async function runFloodTest(options: FloodTestOptions = {}): Promise<FloodTestResult> {
  const client = options.client ?? sqs;
  const queueUrl = options.queueUrl ?? QUEUE_URL;
  const total = options.total ?? TOTAL;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const drainTimeoutMs = options.drainTimeoutMs ?? DRAIN_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const runId = `${now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (total !== TOTAL) {
    throw new Error(`P1-D requires exactly ${TOTAL} messages; received ${total}`);
  }

  const initialDepth = await getQueueDepth(client, queueUrl);
  if (initialDepth.total !== 0) {
    throw new Error(
      `Queue is not empty before the flood (visible=${initialDepth.visible}, inFlight=${initialDepth.inFlight}, delayed=${initialDepth.delayed}). Rerun in an approved quiet window.`
    );
  }

  const startedAtMs = now();
  let sent = 0;

  for (let start = 0; start < total; start += BATCH_SIZE) {
    const entries = buildBatchEntries(start, Math.min(BATCH_SIZE, total - start), runId);
    const response = (await client.send(
      new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: entries })
    )) as SendMessageBatchCommandOutput;
    const failures = response.Failed ?? [];
    if (failures.length > 0) {
      throw new Error(`SQS rejected ${failures.length} messages: ${JSON.stringify(failures)}`);
    }
    sent += response.Successful?.length ?? 0;
    process.stdout.write(".");
  }

  if (sent !== TOTAL) {
    throw new Error(`Expected ${TOTAL} successful sends, but SQS reported ${sent}`);
  }

  const enqueueFinishedAtMs = now();
  let observedBacklog = false;
  let consecutiveZeroPolls = 0;
  let peakVisible = 0;
  let peakInFlight = 0;

  while (now() - enqueueFinishedAtMs <= drainTimeoutMs) {
    const depth = await getQueueDepth(client, queueUrl);
    options.onDepth?.(depth);
    peakVisible = Math.max(peakVisible, depth.visible);
    peakInFlight = Math.max(peakInFlight, depth.inFlight);
    observedBacklog ||= depth.total > 0;
    consecutiveZeroPolls = depth.total === 0 ? consecutiveZeroPolls + 1 : 0;

    console.log(
      `\nQueue depth: visible=${depth.visible}, inFlight=${depth.inFlight}, delayed=${depth.delayed}`
    );

    // SQS queue attributes are approximate. Require a nonzero observation and
    // two consecutive zero polls so eventual consistency cannot create a pass.
    if (observedBacklog && consecutiveZeroPolls >= 2) {
      const drainedAtMs = now();
      return {
        runId,
        totalMessages: TOTAL,
        startedAt: new Date(startedAtMs).toISOString(),
        enqueueFinishedAt: new Date(enqueueFinishedAtMs).toISOString(),
        drainedAt: new Date(drainedAtMs).toISOString(),
        enqueueDurationMs: enqueueFinishedAtMs - startedAtMs,
        drainAfterEnqueueMs: drainedAtMs - enqueueFinishedAtMs,
        totalElapsedMs: drainedAtMs - startedAtMs,
        peakVisible,
        peakInFlight,
      };
    }

    await sleep(pollIntervalMs);
  }

  if (!observedBacklog) {
    throw new Error(
      `SQS never reported the ${TOTAL}-job backlog; no valid drain-time proof was captured`
    );
  }
  throw new Error(`Queue did not drain within ${drainTimeoutMs}ms`);
}

async function flood() {
  console.log(`Sending exactly ${TOTAL} HEALTH_CHECK messages to SQS FIFO queue...`);
  console.log(`Queue: ${QUEUE_URL}`);

  const result = await runFloodTest();
  console.log("\nP1-D flood result:");
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  void flood().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
