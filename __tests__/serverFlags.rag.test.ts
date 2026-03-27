import { afterEach, describe, expect, it } from "vitest";
import { isRagTutorEnabled } from "@/lib/serverFlags";

describe("isRagTutorEnabled", () => {
  afterEach(() => {
    delete process.env.ENABLE_RAG_TUTOR;
    delete process.env.NEXT_PUBLIC_ENABLE_RAG_TUTOR;
  });

  it("returns false when both server and public flags are absent", () => {
    expect(isRagTutorEnabled()).toBe(false);
  });

  it("returns true when the server flag is enabled", () => {
    process.env.ENABLE_RAG_TUTOR = "true";
    expect(isRagTutorEnabled()).toBe(true);
  });

  it("returns true when only the public flag is enabled", () => {
    process.env.NEXT_PUBLIC_ENABLE_RAG_TUTOR = "true";
    expect(isRagTutorEnabled()).toBe(true);
  });
});
