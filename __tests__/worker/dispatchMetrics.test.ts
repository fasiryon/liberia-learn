import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const mocks = vi.hoisted(() => ({
  dispatchJob: vi.fn(),
  publishMetric: vi.fn(),
}));

vi.mock("@/worker/handlers", () => ({ dispatchJob: mocks.dispatchJob }));
vi.mock("@/lib/cloudwatch", () => ({ publishMetric: mocks.publishMetric }));

import { pollOnce } from "@/worker/index";

const sqsMock = mockClient(SQSClient);

function queueOneMessage(jobType: string) {
  sqsMock.on(ReceiveMessageCommand).resolvesOnce({
    Messages: [
      {
        MessageId: "msg-1",
        ReceiptHandle: "receipt-1",
        Body: JSON.stringify({ jobType, payload: {} }),
        Attributes: { ApproximateReceiveCount: "1" },
      },
    ],
  });
  sqsMock.on(DeleteMessageCommand).resolves({});
}

beforeEach(() => {
  vi.clearAllMocks();
  sqsMock.reset();
  mocks.publishMetric.mockResolvedValue(undefined);
  process.env.SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/queue/liberialearn-jobs.fifo";
});

describe("worker job-completion metrics", () => {
  it("reports WorkerJobCompleted and acks when a job actually runs", async () => {
    mocks.dispatchJob.mockResolvedValueOnce({ status: "ok" });
    queueOneMessage("HEALTH_CHECK");

    await pollOnce();

    expect(mocks.publishMetric).toHaveBeenCalledWith(
      expect.objectContaining({ metricName: "WorkerJobCompleted" })
    );
    expect(sqsMock.commandCalls(DeleteMessageCommand)).toHaveLength(1);
  });

  it("reports WorkerJobNoop (not WorkerJobCompleted) for a known-but-unimplemented job", async () => {
    mocks.dispatchJob.mockResolvedValueOnce({ status: "noop", jobType: "GENERATE_LESSON_AUDIO" });
    queueOneMessage("GENERATE_LESSON_AUDIO");

    await pollOnce();

    expect(mocks.publishMetric).toHaveBeenCalledWith(
      expect.objectContaining({ metricName: "WorkerJobNoop" })
    );
    expect(mocks.publishMetric).not.toHaveBeenCalledWith(
      expect.objectContaining({ metricName: "WorkerJobCompleted" })
    );
    // Still acked, so it doesn't pile up or hit the DLQ.
    expect(sqsMock.commandCalls(DeleteMessageCommand)).toHaveLength(1);
  });

  it("reports WorkerJobUnknown (not WorkerJobCompleted) for an unrecognized job type", async () => {
    mocks.dispatchJob.mockResolvedValueOnce({ status: "unknown", jobType: "SOME_FUTURE_TYPE" });
    queueOneMessage("SOME_FUTURE_TYPE");

    await pollOnce();

    expect(mocks.publishMetric).toHaveBeenCalledWith(
      expect.objectContaining({ metricName: "WorkerJobUnknown" })
    );
    expect(mocks.publishMetric).not.toHaveBeenCalledWith(
      expect.objectContaining({ metricName: "WorkerJobCompleted" })
    );
    expect(sqsMock.commandCalls(DeleteMessageCommand)).toHaveLength(1);
  });
});
