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

    const enqueued = await enqueueJob(JobType.SEND_SMS, { to: "+231770000000", body: "Hello" }, {
      messageGroupId: "sms",
      messageDeduplicationId: "sms-1",
    });

    const calls = sqsMock.commandCalls(SendMessageCommand);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.args[0].input.QueueUrl).toBe(process.env.SQS_QUEUE_URL);
    expect(call.args[0].input.MessageGroupId).toBe("sms");
    expect(call.args[0].input.MessageDeduplicationId).toBe("sms-1");
    expect(enqueued).toBe(true);
  });

  it("derives FIFO attributes when callers do not override them", async () => {
    sqsMock.on(SendMessageCommand).resolves({});

    const enqueued = await enqueueJob(JobType.SEND_SMS, { to: "+231770000000", body: "Hello" });

    const [call] = sqsMock.commandCalls(SendMessageCommand);
    expect(call.args[0].input.MessageGroupId).toBe(JobType.SEND_SMS);
    expect(call.args[0].input.MessageDeduplicationId).toMatch(/^[a-f0-9]{64}$/);
    expect(enqueued).toBe(true);
  });

  it("omits FIFO-only attributes for standard queues", async () => {
    process.env.SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/queue/liberialearn-jobs";
    sqsMock.on(SendMessageCommand).resolves({});

    await enqueueJob(JobType.SEND_SMS, { to: "+231770000000", body: "Hello" }, {
      messageGroupId: "sms",
      messageDeduplicationId: "sms-1",
    });

    const [call] = sqsMock.commandCalls(SendMessageCommand);
    expect(call.args[0].input.MessageGroupId).toBeUndefined();
    expect(call.args[0].input.MessageDeduplicationId).toBeUndefined();
  });

  it("skips enqueue when SQS_QUEUE_URL is missing", async () => {
    delete process.env.SQS_QUEUE_URL;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const enqueued = await enqueueJob(JobType.SEND_SMS, { to: "+231770000000", body: "Hello" });

    expect(sqsMock.commandCalls(SendMessageCommand)).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    expect(enqueued).toBe(false);
    warnSpy.mockRestore();
  });

  it("returns false when SQS rejects the send", async () => {
    sqsMock.on(SendMessageCommand).rejects(new Error("SQS unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const enqueued = await enqueueJob(JobType.ONEROSTER_IMPORT, {
      batchId: "batch-1",
      schoolId: "school-1",
    });

    expect(enqueued).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
