import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message,
} from "@aws-sdk/client-sqs";
import { JobType } from "@/lib/queue";
import { dispatchJob } from "@/worker/handlers";
import { initWorkerSentry, Sentry } from "@/worker/sentry";

type QueueEnvelope = {
  jobType: JobType;
  payload: unknown;
};

const queueUrl = process.env.SQS_QUEUE_URL?.trim() ?? "";
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
});

let shuttingDown = false;

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

async function handleMessage(message: Message) {
  const envelope = parseEnvelope(message);
  await dispatchJob(envelope.jobType, envelope.payload);
  await deleteMessage(message);
}

async function pollOnce() {
  const response = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 20,
      MessageAttributeNames: ["ApproximateReceiveCount"],
    })
  );

  for (const message of response.Messages ?? []) {
    try {
      await handleMessage(message);
    } catch (error) {
      const receiveCount = Number(message.Attributes?.ApproximateReceiveCount ?? "1");
      const reason = error instanceof Error ? error.message : String(error);
      Sentry.captureException(error, {
        tags: { component: "worker", queue: "liberialearn-jobs" },
        extra: { receiveCount },
      });
      console.error("[WORKER] job failed", {
        receiveCount,
        reason,
      });
      if (receiveCount >= 3) {
        console.error("[WORKER] message will be moved to the DLQ by SQS redrive policy");
      }
    }
  }
}

async function run() {
  initWorkerSentry();

  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL is required");
  }

  while (!shuttingDown) {
    await pollOnce();
  }
}

process.on("SIGTERM", () => {
  shuttingDown = true;
});

process.on("SIGINT", () => {
  shuttingDown = true;
});

run().catch((error) => {
  Sentry.captureException(error, {
    tags: { component: "worker", phase: "startup" },
  });
  console.error("[WORKER] fatal error", error);
  process.exit(1);
});
