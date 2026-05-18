// Flood test: sends 200 HEALTH_CHECK messages to verify worker scales and drains.
// Run OUTSIDE school hours (not Mon-Fri 08:00-15:00 GMT).
// Usage: npx dotenv -e .env.production -- npx tsx scripts/flood-test-queue.ts
//   or with local AWS credentials: npx tsx scripts/flood-test-queue.ts

import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";

const QUEUE_URL = process.env.SQS_QUEUE_URL || "https://sqs.us-east-1.amazonaws.com/258048833400/liberialearn-jobs.fifo";
const BATCH_SIZE = 10;
const TOTAL = 200;

const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });

async function flood() {
  console.log(`Sending ${TOTAL} HEALTH_CHECK messages to SQS FIFO queue...`);
  console.log(`Queue: ${QUEUE_URL}`);

  for (let i = 0; i < TOTAL / BATCH_SIZE; i++) {
    const entries = Array.from({ length: BATCH_SIZE }, (_, j) => {
      const seq = i * BATCH_SIZE + j;
      return {
        Id: `msg-${seq}`,
        MessageBody: JSON.stringify({
          jobType: "HEALTH_CHECK",
          payload: { seq, ts: Date.now() },
          enqueuedAt: new Date().toISOString(),
        }),
        MessageGroupId: "flood-test",
        MessageDeduplicationId: `flood-${Date.now()}-${seq}`,
      };
    });

    await sqs.send(new SendMessageBatchCommand({ QueueUrl: QUEUE_URL, Entries: entries }));
    process.stdout.write(".");
  }

  console.log(`\n\nDone. ${TOTAL} messages sent.`);
  console.log("\nMonitor worker scale-out:");
  console.log(
    `  aws ecs list-tasks --cluster liberia-learn --service-name liberia-learn-worker --region us-east-1`
  );
  console.log("\nCheck queue depth:");
  console.log(
    `  aws sqs get-queue-attributes --queue-url "${QUEUE_URL}" --attribute-names ApproximateNumberOfMessages --region us-east-1`
  );
}

flood().catch(console.error);
