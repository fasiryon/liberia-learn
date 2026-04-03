import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
  type Message,
} from "@aws-sdk/client-sqs";
import { publishMetric } from "@/lib/cloudwatch";
import { logger } from "@/lib/logger";
import { JobType } from "@/lib/queue";
import { dispatchJob } from "@/worker/handlers";
import { initWorkerSentry, Sentry } from "@/worker/sentry";

declare const require: undefined | { main?: unknown };
declare const module: undefined | unknown;

type QueueEnvelope = {
  jobType: JobType;
  payload: unknown;
};

const MAX_RETRIES = 3;
const queueUrl = process.env.SQS_QUEUE_URL?.trim() ?? "";
const dlqUrl = process.env.SQS_DLQ_URL?.trim() ?? "";
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
});

let shuttingDown = false;
let inFlightMessage: Promise<void> | null = null;

function parseEnvelope(message: Message): QueueEnvelope {
  if (!message.Body) {
    throw new Error("Received SQS message without body");
  }

  const parsed = JSON.parse(message.Body) as QueueEnvelope;
  if (!parsed?.jobType) {
    throw new Error("Received SQS message without jobType");
  }

  return parsed;
}

function getReceiveCount(message: Message) {
  return Number(message.Attributes?.ApproximateReceiveCount ?? "1");
}

async function deleteMessage(message: Message) {
  if (!message.ReceiptHandle) {
    return;
  }

  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    })
  );
}

async function moveToDlq(message: Message, reason: string) {
  if (!dlqUrl || !message.Body) {
    return false;
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: dlqUrl,
      MessageBody: message.Body,
      MessageAttributes: {
        failureReason: {
          DataType: "String",
          StringValue: reason.slice(0, 256),
        },
      },
    })
  );
  await deleteMessage(message);
  return true;
}

async function handleMessage(message: Message) {
  const envelope = parseEnvelope(message);
  const startedAt = Date.now();
  logger.info(`[WORKER] Processing ${envelope.jobType}`, {
    messageType: envelope.jobType,
  });
  await dispatchJob(envelope.jobType, envelope.payload);
  void publishMetric({
    metricName: "WorkerJobCompleted",
    value: 1,
    unit: "Count",
    dimensions: { JobType: envelope.jobType },
  }).catch((error) => {
    logger.error("[CloudWatch] failed to publish WorkerJobCompleted", { error });
  });
  await deleteMessage(message);
  logger.info(`[WORKER] Processed ${envelope.jobType} in ${Date.now() - startedAt}ms`, {
    messageType: envelope.jobType,
    durationMs: Date.now() - startedAt,
  });
}

async function processMessage(message: Message) {
  try {
    await handleMessage(message);
  } catch (error) {
    const envelope = (() => {
      try {
        return parseEnvelope(message);
      } catch {
        return null;
      }
    })();
    const receiveCount = getReceiveCount(message);
    const reason = error instanceof Error ? error.message : String(error);

    Sentry.captureException(error, {
      tags: { component: "worker", queue: "liberialearn-jobs" },
      extra: {
        receiveCount,
        messageBody: message.Body ?? null,
        messageType: envelope?.jobType ?? "UNKNOWN",
      },
    });

    void publishMetric({
      metricName: "WorkerJobFailed",
      value: 1,
      unit: "Count",
      dimensions: { JobType: envelope?.jobType ?? "UNKNOWN" },
    }).catch((metricError) => {
      logger.error("[CloudWatch] failed to publish WorkerJobFailed", { error: metricError });
    });

    logger.error("[WORKER] job failed", {
      messageType: envelope?.jobType ?? "UNKNOWN",
      receiveCount,
      reason,
    });

    if (receiveCount >= MAX_RETRIES) {
      const movedToDlq = await moveToDlq(message, reason).catch((dlqError) => {
        logger.error("[WORKER] failed to move message to DLQ", {
          messageType: envelope?.jobType ?? "UNKNOWN",
          error: dlqError,
        });
        return false;
      });

      logger.error("[WORKER] message reached max retries", {
        messageType: envelope?.jobType ?? "UNKNOWN",
        receiveCount,
        movedToDlq,
        messageBody: message.Body ?? null,
      });

      if (!movedToDlq) {
        logger.error("[WORKER] message will be moved to the DLQ by SQS redrive policy", {
          messageType: envelope?.jobType ?? "UNKNOWN",
          receiveCount,
        });
      }
    }
  }
}

async function pollOnce() {
  const response = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 20,
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
    })
  );

  for (const message of response.Messages ?? []) {
    if (shuttingDown) {
      break;
    }

    inFlightMessage = processMessage(message);
    await inFlightMessage;
    inFlightMessage = null;
  }
}

async function run() {
  initWorkerSentry();

  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL is required");
  }

  logger.info(`[WORKER] Starting. Queue: ${queueUrl}`, {
    queueUrl,
    dlqConfigured: Boolean(dlqUrl),
    maxRetries: MAX_RETRIES,
  });

  while (!shuttingDown) {
    await pollOnce();
  }

  if (inFlightMessage) {
    await inFlightMessage;
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info(`[WORKER] Received ${signal}. Draining current message before exit.`);

  if (inFlightMessage) {
    await inFlightMessage;
  }

  logger.info("[WORKER] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

const isDirectExecution =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

if (isDirectExecution) {
  void run().catch((error) => {
    Sentry.captureException(error, {
      tags: { component: "worker", phase: "startup" },
    });
    logger.error("[WORKER] fatal error", { error });
    process.exit(1);
  });
}
