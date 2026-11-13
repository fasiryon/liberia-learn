/// <reference lib="webworker" />
/**
 * One-shot LL Code worker. The page starts a fresh worker per run and terminates it after one result or at the hard
 * timeout. The security boundary is the interpreter (llcode.ts): learner programs are parsed and interpreted, so they
 * cannot name any host API. Removing network and loader capabilities from this scope is defence in depth only.
 */
import { runLLCode, type LLCodeLimits, type LLPresetValue } from "./llcode";

const scope = self as unknown as Record<string, unknown>;
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker"]) {
  try { Object.defineProperty(scope, name, { value: undefined, configurable: false, writable: false }); } catch { /* already absent */ }
}

let used = false;
self.onmessage = (event: MessageEvent<{ source: string; inputs?: string[]; presets?: Record<string, LLPresetValue>; limits?: Partial<LLCodeLimits>; trace?: boolean }>) => {
  if (used) return; // one program per worker
  used = true;
  const { source, inputs, presets, limits, trace } = event.data ?? ({} as never);
  (self as unknown as Worker).postMessage(runLLCode(String(source ?? ""), { inputs: Array.isArray(inputs) ? inputs.map(String) : [], presets: presets && typeof presets === "object" ? presets : undefined, limits, trace: Boolean(trace) }));
};
