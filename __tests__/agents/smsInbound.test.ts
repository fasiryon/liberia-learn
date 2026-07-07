import { describe, it, expect } from "vitest";
import { parseInboundSms, normalizeMsisdn } from "@/lib/agents/sms/inbound";

describe("normalizeMsisdn", () => {
  it("strips spaces and keeps a leading +", () => {
    expect(normalizeMsisdn(" +231 77 123 4567 ")).toBe("+231771234567");
  });
  it("adds a leading + when missing", () => {
    expect(normalizeMsisdn("231771234567")).toBe("+231771234567");
  });
});

describe("parseInboundSms", () => {
  it("returns a normalized inbound message", () => {
    const r = parseInboundSms({ from: "+231 770 000 111", text: "  Hi how is my son  " });
    expect(r.normalizedFrom).toBe("+231770000111");
    expect(r.text).toBe("Hi how is my son");
    expect(typeof r.receivedAt).toBe("string");
  });

  it("throws a 400 when 'from' is missing", () => {
    expect(() => parseInboundSms({ from: "", text: "hi" })).toThrow(/from/i);
  });

  it("throws a 400 when 'text' is empty", () => {
    expect(() => parseInboundSms({ from: "+231770000111", text: "   " })).toThrow(/text/i);
  });
});
