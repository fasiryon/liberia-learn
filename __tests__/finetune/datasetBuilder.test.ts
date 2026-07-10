import { describe, it, expect } from "vitest";
import {
  buildSftExample,
  buildDataset,
  splitTrainVal,
  estimateTokens,
  estimateFtCostUSD,
  toJsonl,
  SFT_SYSTEM,
} from "@/lib/finetune/datasetBuilder";

function lesson(overrides: Record<string, unknown> = {}) {
  return {
    contentId: "c1",
    title: "Place Value to Thousands",
    grade: 4,
    subject: "MATH",
    status: "published",
    payload: {
      body: "A ".repeat(400) + "full lesson body about place value.",
      objectives: ["Read 4-digit numbers", "Compare place values"],
    },
    ...overrides,
  };
}

describe("buildSftExample", () => {
  it("maps an approved lesson to a system/user/assistant example", () => {
    const ex = buildSftExample(lesson())!;
    expect(ex.messages).toHaveLength(3);
    expect(ex.messages[0]).toEqual({ role: "system", content: SFT_SYSTEM });
    expect(ex.messages[1].role).toBe("user");
    expect(ex.messages[1].content).toMatch(/Grade 4/);
    expect(ex.messages[1].content).toMatch(/MATH/);
    expect(ex.messages[1].content).toMatch(/Place Value/);
    expect(ex.messages[1].content).toMatch(/Read 4-digit numbers/);
    expect(ex.messages[2].role).toBe("assistant");
    expect(ex.messages[2].content).toContain("full lesson body");
    expect(ex.meta.contentId).toBe("c1");
  });

  it("returns null when the body is missing or too short", () => {
    expect(buildSftExample(lesson({ payload: { body: "" } }))).toBeNull();
    expect(buildSftExample(lesson({ payload: { body: "too short" } }))).toBeNull();
    expect(buildSftExample(lesson({ payload: {} }))).toBeNull();
  });
});

describe("buildDataset", () => {
  it("keeps valid lessons and reports skips", () => {
    const { examples, skipped } = buildDataset([
      lesson({ contentId: "a" }),
      lesson({ contentId: "b", payload: { body: "short" } }),
    ]);
    expect(examples).toHaveLength(1);
    expect(examples[0].meta.contentId).toBe("a");
    expect(skipped).toBe(1);
  });

  it("dedupes by contentId and by identical body", () => {
    const { examples } = buildDataset([
      lesson({ contentId: "a" }),
      lesson({ contentId: "a" }), // dup id
      lesson({ contentId: "c" }), // same body as a -> dup body
    ]);
    expect(examples).toHaveLength(1);
  });
});

describe("splitTrainVal", () => {
  it("splits deterministically with a seed and no overlap", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const a = splitTrainVal(items, 0.1, 42);
    const b = splitTrainVal(items, 0.1, 42);
    expect(a.val.length).toBe(10);
    expect(a.train.length).toBe(90);
    expect(a.val).toEqual(b.val); // deterministic
    const ids = new Set([...a.train, ...a.val].map((x) => x.id));
    expect(ids.size).toBe(100); // covers all, no loss
  });
});

describe("cost + serialization", () => {
  it("estimates tokens roughly by characters", () => {
    expect(estimateTokens("abcd".repeat(100))).toBeGreaterThan(80);
  });

  it("estimates gpt-4o-mini FT training cost from tokens and epochs", () => {
    // 1,000,000 training tokens x 3 epochs at $3/1M = ~$9
    const examples = [{ meta: { tokensApprox: 1_000_000 } }] as never[];
    expect(estimateFtCostUSD(examples, 3)).toBeCloseTo(9, 1);
  });

  it("serializes to JSONL, one valid object per line", () => {
    const { examples } = buildDataset([lesson()]);
    const jsonl = toJsonl(examples);
    const lines = jsonl.trim().split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.messages).toHaveLength(3);
    expect(parsed).not.toHaveProperty("meta"); // JSONL is FT-format only
  });
});
