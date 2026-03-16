import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { enqueueJob, JobType } from "@/lib/queue";

const sqsMock = mockClient(SQSClient);

describe("enqueueJob", () => {
  beforeEach(() => {
    sqsMock.reset();
    process.env.SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/queue/liberialearn-jobs.fifo";
  });

  it("sends the job to SQS with group and deduplication ids", async () => {
    sqsMock.on(SendMessageCommand).resolves({});

    await enqueueJob(JobType.SEND_SMS, { to: "+231770000000", body: "Hello" });

    const calls = sqsMock.commandCalls(SendMessageCommand);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.args[0].input.QueueUrl).toBe(process.env.SQS_QUEUE_URL);
    expect(call.args[0].input.MessageGroupId).toBe(JobType.SEND_SMS);
    expect(call.args[0].input.MessageDeduplicationId).toMatch(/^[a-f0-9]{64}$/);
  });

  it("skips enqueue when SQS_QUEUE_URL is missing", async () => {
    delete process.env.SQS_QUEUE_URL;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await enqueueJob(JobType.SEND_SMS, { to: "+231770000000", body: "Hello" });

    expect(sqsMock.commandCalls(SendMessageCommand)).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
