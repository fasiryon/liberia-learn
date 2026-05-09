import { createHash } from "crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

export enum JobType {
  GENERATE_EMBEDDINGS = "GENERATE_EMBEDDINGS",
  GENERATE_LESSON_AUDIO = "GENERATE_LESSON_AUDIO",
  GENERATE_TEXTBOOK = "GENERATE_TEXTBOOK",
  SNAPSHOT_ANALYTICS = "SNAPSHOT_ANALYTICS",
  SEND_SMS = "SEND_SMS",
  CONFUSION_DETECTION = "CONFUSION_DETECTION",
  STUDENT_IMPORT = "STUDENT_IMPORT",
  GENERATE_COURSE_THUMBNAIL = "GENERATE_COURSE_THUMBNAIL",
  GENERATE_SCHOOL_ONBOARDING_KIT = "GENERATE_SCHOOL_ONBOARDING_KIT",
  GENERATE_CERTIFICATION_ASSETS = "GENERATE_CERTIFICATION_ASSETS",
  CURRICULUM_REGENERATE_LESSON = "curriculum.regenerate.lesson",
  CURRICULUM_REGENERATE_GROUP = "curriculum.regenerate.group",
  CURRICULUM_REGENERATE_RESUME = "curriculum.regenerate.resume",
  QUEUE_READINESS_PROBE = "queue.readiness.probe",
}

type QueueEnvelope = {
  jobType: JobType;
  payload: unknown;
  enqueuedAt: string;
};

let sqsClient: SQSClient | null = null;

function getQueueUrl() {
  return process.env.SQS_QUEUE_URL?.trim() ?? "";
}

function getSqsClient() {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
    });
  }
  return sqsClient;
}

export function isQueueConfigured() {
  return getQueueUrl().length > 0;
}

export function isFifoQueueUrl(queueUrl = getQueueUrl()) {
  return queueUrl.trim().toLowerCase().includes(".fifo");
}

type EnqueueJobOptions = {
  messageGroupId?: string | null;
  messageDeduplicationId?: string | null;
};

function buildDeduplicationId(jobType: JobType, payload: unknown) {
  return createHash("sha256")
    .update(`${jobType}:${JSON.stringify(payload)}`)
    .digest("hex");
}

export async function enqueueJob(jobType: JobType, payload: unknown, options: EnqueueJobOptions = {}): Promise<void> {
  const queueUrl = getQueueUrl();
  if (!queueUrl) {
    console.warn("[QUEUE] SQS_QUEUE_URL not configured; skipping enqueue", { jobType });
    return;
  }

  const body: QueueEnvelope = {
    jobType,
    payload,
    enqueuedAt: new Date().toISOString(),
  };
  const fifoAttributes = isFifoQueueUrl(queueUrl)
    ? {
        MessageGroupId: options.messageGroupId?.trim() || jobType,
        MessageDeduplicationId: options.messageDeduplicationId?.trim() || buildDeduplicationId(jobType, payload),
      }
    : {};

  await getSqsClient().send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(body),
      ...fifoAttributes,
    })
  );
}
