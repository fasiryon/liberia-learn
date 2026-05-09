import {
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { JobType } from "@/lib/queue";

function isConfigured(value?: string | null) {
  return Boolean(value?.trim());
}

function getRegion() {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}

function getQueueUrl() {
  return process.env.SQS_QUEUE_URL?.trim() ?? "";
}

export function redactQueueUrl(queueUrl = getQueueUrl()) {
  if (!queueUrl) return null;
  try {
    const parsed = new URL(queueUrl);
    const queueName = parsed.pathname.split("/").filter(Boolean).at(-1) ?? "unknown";
    return `${parsed.protocol}//${parsed.host}/.../${queueName}`;
  } catch {
    const queueName = queueUrl.split("/").filter(Boolean).at(-1) ?? "unknown";
    return `.../${queueName}`;
  }
}

export async function getQueueReadiness() {
  const queueUrl = getQueueUrl();
  const region = getRegion();
  const base = {
    configured: Boolean(queueUrl),
    queueUrl: redactQueueUrl(queueUrl),
    regionConfigured: isConfigured(process.env.AWS_REGION) || isConfigured(process.env.AWS_DEFAULT_REGION),
    fifoDetected: queueUrl.toLowerCase().includes(".fifo"),
    sendPermissions: false,
    receiveDeletePermissions: false,
  };

  if (!queueUrl) {
    return {
      ...base,
      reachable: false,
      errorCode: "SQS_QUEUE_URL_NOT_CONFIGURED",
    };
  }

  const client = new SQSClient({ region });
  const probeId = `queue-health-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const probeBody = JSON.stringify({
    jobType: JobType.QUEUE_READINESS_PROBE,
    payload: { probeId },
    enqueuedAt: new Date().toISOString(),
  });

  try {
    const attributes = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["QueueArn", "FifoQueue"],
      })
    );
    const fifoDetected = attributes.Attributes?.FifoQueue === "true" || base.fifoDetected;

    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: probeBody,
        ...(fifoDetected
          ? {
              MessageGroupId: "queue-readiness",
              MessageDeduplicationId: probeId,
            }
          : {}),
      })
    );

    const received = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 2,
        VisibilityTimeout: 10,
      })
    );
    const probe = (received.Messages ?? []).find((message) => {
      if (!message.Body) return false;
      try {
        return JSON.parse(message.Body)?.payload?.probeId === probeId;
      } catch {
        return false;
      }
    });
    if (probe?.ReceiptHandle) {
      await client.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: probe.ReceiptHandle,
        })
      );
    }

    return {
      ...base,
      reachable: true,
      fifoDetected,
      sendPermissions: true,
      receiveDeletePermissions: Boolean(probe?.ReceiptHandle),
      errorCode: probe?.ReceiptHandle ? null : "SQS_PROBE_MESSAGE_NOT_RECEIVED",
    };
  } catch (error) {
    return {
      ...base,
      reachable: false,
      errorCode: "SQS_READINESS_CHECK_FAILED",
      errorName: error instanceof Error ? error.name : "UnknownError",
    };
  }
}
