"use client";
/**
 * Runs one LL Code program in a fresh Web Worker with a hard page-side timeout and a learner Stop control: the worker
 * is terminated after the result, at the timeout, or on stop(), whichever comes first. No learner code ever runs on
 * the application server or on the page thread: without Worker support, or when the Worker cannot be created
 * (for example a CSP refusal), the program is refused with a fixed message.
 */
import { z } from "zod";
import { LLCODE_LIMITS, LLCODE_VERSION, type LLCodeLimits, type LLCodeResult, type LLPresetValue } from "./llcode";

const stopped = (message: string): LLCodeResult => ({ version: LLCODE_VERSION, ok: false, output: [], steps: 0, trace: [], traceTruncated: false, error: { kind: "LIMIT", line: null, message } });
const CRASHED = "The program could not run.";
const crashed = (): LLCodeResult => ({ ...stopped(CRASHED), error: { kind: "RUNTIME", line: null, message: CRASHED } });
/** Only a well-formed, bounded interpreter result reaches the learner; anything else fails closed. */
const resultSchema = z.strictObject({
  version: z.literal(LLCODE_VERSION), ok: z.boolean(),
  output: z.array(z.string().max(LLCODE_LIMITS.outputBytes)).max(LLCODE_LIMITS.outputLines),
  error: z.strictObject({ kind: z.enum(["SYNTAX", "RUNTIME", "LIMIT"]), line: z.number().int().nonnegative().nullable(), message: z.string().max(500) }).nullable(),
  steps: z.number().int().nonnegative().max(LLCODE_LIMITS.steps + 1),
  trace: z.array(z.strictObject({ step: z.number().int(), line: z.number().int(), vars: z.record(z.string(), z.string()), output: z.number().int().nonnegative() })).max(LLCODE_LIMITS.traceEntries),
  traceTruncated: z.boolean(),
}).refine((r) => r.ok === (r.error === null));
const UNAVAILABLE = "This program can only run in a protected sandbox, which this browser cannot start.";
const unavailable = (): LLCodeResult => ({ ...stopped(UNAVAILABLE), error: { kind: "RUNTIME", line: null, message: UNAVAILABLE } });

export function startInWorker(source: string, options: { inputs?: string[]; presets?: Readonly<Record<string, LLPresetValue>>; limits?: Partial<LLCodeLimits>; trace?: boolean } = {}): { result: Promise<LLCodeResult>; stop: () => void } {
  const timeoutMs = Math.min(LLCODE_LIMITS.timeoutMs, options.limits?.timeoutMs ?? LLCODE_LIMITS.timeoutMs);
  if (typeof Worker !== "function") return { result: Promise.resolve(unavailable()), stop: () => undefined };
  let finish: (r: LLCodeResult) => void = () => undefined;
  const result = new Promise<LLCodeResult>((resolve) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./llcode.worker.ts", import.meta.url), { type: "module", name: "llcode" }); }
    catch { resolve(unavailable()); return; }
    let settled = false;
    finish = (r) => { if (settled) return; settled = true; window.clearTimeout(timer); worker.terminate(); resolve(r); };
    const timer = window.setTimeout(() => finish(stopped(`The program took longer than ${timeoutMs / 1000} seconds and was stopped.`)), timeoutMs);
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const parsed = resultSchema.safeParse(event.data);
      finish(parsed.success ? (parsed.data as LLCodeResult) : crashed());
    };
    worker.onerror = () => finish(crashed());
    worker.onmessageerror = () => finish(crashed());
    worker.postMessage({ source, inputs: options.inputs ?? [], presets: options.presets, limits: options.limits, trace: options.trace ?? false });
  });
  return { result, stop: () => finish(stopped("You stopped the program.")) };
}

/** Convenience for callers that never need Stop (tracing a short fixed program). */
export const runInWorker = (source: string, options: Parameters<typeof startInWorker>[1] = {}) => startInWorker(source, options).result;
