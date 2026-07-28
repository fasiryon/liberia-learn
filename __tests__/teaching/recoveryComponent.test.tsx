import { describe, expect, it } from "vitest";
import { TeachingRecoveryControls } from "@/components/teaching/TeachingRecoveryControls";

describe("TeachingRecoveryControls", () => {
  it("exports the client-side facilitator recovery surface", () => {
    expect(typeof TeachingRecoveryControls).toBe("function");
  });
});
