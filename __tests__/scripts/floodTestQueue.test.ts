import {
  GetQueueAttributesCommand,
  SendMessageBatchCommand,
} from "@aws-sdk/client-sqs";
import { describe, expect, it, vi } from "vitest";
import {
  TOTAL,
  buildBatchEntries,
  readQueueDepth,
  runFloodTest,
  type SqsSender,
} from "@/scripts/flood-test-queue";

describe("P1-D worker flood test", () => {
  it("builds parallelizable FIFO entries with unique IDs", () => {
    const entries = Array.from({ length: TOTAL / 10 }, (_, batch) =>
      buildBatchEntries(batch * 10, 10, "run-1")
    ).flat();

    expect(entries).toHaveLength(TOTAL);
    expect(new Set(entries.map((entry) => entry.MessageGroupId))).toHaveLength(TOTAL);
    expect(new Set(entries.map((entry) => entry.MessageDeduplicationId))).toHaveLength(TOTAL);
  });

  it("includes visible, in-flight, and delayed messages in queue depth", () => {
    expect(
      readQueueDepth({
        ApproximateNumberOfMessages: "7",
        ApproximateNumberOfMessagesNotVisible: "2",
        ApproximateNumberOfMessagesDelayed: "1",
      })
    ).toEqual({ visible: 7, inFlight: 2, delayed: 1, total: 10 });
  });

  it("sends exactly TOTAL jobs and requires an observed backlog plus two zero polls", async () => {
    const depths = [
      { ApproximateNumberOfMessages: "0" },
      { ApproximateNumberOfMessages: "180", ApproximateNumberOfMessagesNotVisible: "20" },
      { ApproximateNumberOfMessages: "0", ApproximateNumberOfMessagesNotVisible: "0" },
      { ApproximateNumberOfMessages: "0", ApproximateNumberOfMessagesNotVisible: "0" },
    ];
    let sendBatches = 0;
    const client: SqsSender = {
      send: vi.fn(async (command: unknown) => {
        if (command instanceof GetQueueAttributesCommand) {
          return { Attributes: depths.shift() ?? {} };
        }
        const sendCommand = command as SendMessageBatchCommand;
        sendBatches += 1;
        return {
          Successful: sendCommand.input.Entries?.map((entry) => ({ Id: entry.Id })) ?? [],
          Failed: [],
        };
      }),
    };
    let clock = Date.parse("2026-08-05T19:00:00.000Z");

    const result = await runFloodTest({
      client,
      queueUrl: "https://sqs.us-east-1.amazonaws.com/123/test.fifo",
      pollIntervalMs: 0,
      now: () => {
        clock += 1_000;
        return clock;
      },
      sleep: async () => undefined,
    });

    expect(sendBatches).toBe(TOTAL / 10);
    expect(result.totalMessages).toBe(TOTAL);
    expect(result.peakVisible).toBe(180);
    expect(result.peakInFlight).toBe(20);
  });

  it("refuses to mix the proof with a pre-existing queue backlog", async () => {
    const client: SqsSender = {
      send: vi.fn().mockResolvedValue({
        Attributes: { ApproximateNumberOfMessages: "1" },
      }),
    };

    await expect(
      runFloodTest({
        client,
        queueUrl: "https://sqs.us-east-1.amazonaws.com/123/test.fifo",
      })
    ).rejects.toThrow("Queue is not empty before the flood");
  });
});
