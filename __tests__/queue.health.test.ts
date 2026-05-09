import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSqsSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-sqs", () => ({
  DeleteMessageCommand: vi.fn().mockImplementation(function (input) {
    return { input, commandName: "DeleteMessageCommand" };
  }),
  GetQueueAttributesCommand: vi.fn().mockImplementation(function (input) {
    return { input, commandName: "GetQueueAttributesCommand" };
  }),
  ReceiveMessageCommand: vi.fn().mockImplementation(function (input) {
    return { input, commandName: "ReceiveMessageCommand" };
  }),
  SendMessageCommand: vi.fn().mockImplementation(function (input) {
    return { input, commandName: "SendMessageCommand" };
  }),
  SQSClient: vi.fn().mockImplementation(function () {
    return { send: mockSqsSend };
  }),
}));

const ORIGINAL_SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
const ORIGINAL_AWS_REGION = process.env.AWS_REGION;

function restoreEnv(key: string, value: string | undefined) {
  if (value == null) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("queue health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123456789012/liberialearn-jobs.fifo";
    process.env.AWS_REGION = "us-east-1";
  });

  afterEach(() => {
    restoreEnv("SQS_QUEUE_URL", ORIGINAL_SQS_QUEUE_URL);
    restoreEnv("AWS_REGION", ORIGINAL_AWS_REGION);
  });

  it("reports FIFO readiness with send and receive/delete permissions", async () => {
    mockSqsSend.mockImplementation(async (command) => {
      if (command.commandName === "GetQueueAttributesCommand") {
        return { Attributes: { FifoQueue: "true", QueueArn: "arn:aws:sqs:us-east-1:123456789012:liberialearn-jobs.fifo" } };
      }
      if (command.commandName === "ReceiveMessageCommand") {
        return {
          Messages: [
            {
              Body: JSON.stringify({ jobType: "queue.readiness.probe", payload: { probeId: JSON.parse(mockSqsSend.mock.calls[1][0].input.MessageBody).payload.probeId } }),
              ReceiptHandle: "receipt-1",
            },
          ],
        };
      }
      return {};
    });

    const { GET } = await import("@/app/api/health/queue/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sqs).toEqual(expect.objectContaining({
      configured: true,
      fifoDetected: true,
      sendPermissions: true,
      receiveDeletePermissions: true,
      queueUrl: "https://sqs.us-east-1.amazonaws.com/.../liberialearn-jobs.fifo",
    }));
    expect(JSON.stringify(body)).not.toContain("123456789012");
  });

  it("fails closed when SQS is not configured", async () => {
    delete process.env.SQS_QUEUE_URL;
    const { GET } = await import("@/app/api/health/queue/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.sqs).toEqual(expect.objectContaining({
      configured: false,
      sendPermissions: false,
      receiveDeletePermissions: false,
    }));
    expect(mockSqsSend).not.toHaveBeenCalled();
  });
});
