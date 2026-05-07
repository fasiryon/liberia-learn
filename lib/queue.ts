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

export async function enqueueJob(jobType: JobType, payload: unknown): Promise<void> {
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
  const deduplicationId = createHash("sha256")
    .update(`${jobType}:${JSON.stringify(payload)}`)
    .digest("hex");

  await getSqsClient().send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(body),
      MessageGroupId: jobType,
      MessageDeduplicationId: deduplicationId,
    })
  );
}
