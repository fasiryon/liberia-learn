import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadHookWithMockedReact() {
  let cleanup: (() => void) | undefined;
  vi.resetModules();
  vi.doMock("react", () => ({
    useRef: (value: unknown) => ({ current: value }),
    useCallback: (fn: unknown) => fn,
    useEffect: (effect: () => void | (() => void)) => {
      const result = effect();
      cleanup = typeof result === "function" ? result : undefined;
    },
  }));
  const mod = await import("@/lib/hooks/useAssignmentPolling");
  return {
    useAssignmentPolling: mod.useAssignmentPolling,
    cleanup: () => cleanup?.(),
  };
}

describe("useAssignmentPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.doUnmock("react");
  });

  it("calls fetchAssignments on mount", async () => {
    const { useAssignmentPolling } = await loadHookWithMockedReact();
    const fetchAssignments = vi.fn().mockResolvedValue(undefined);

    useAssignmentPolling(fetchAssignments);
    await Promise.resolve();

    expect(fetchAssignments).toHaveBeenCalledTimes(1);
  });

  it("calls fetchAssignments every 30 seconds", async () => {
    const { useAssignmentPolling } = await loadHookWithMockedReact();
    const fetchAssignments = vi.fn().mockResolvedValue(undefined);

    useAssignmentPolling(fetchAssignments);
    await vi.advanceTimersByTimeAsync(30000);
    await vi.advanceTimersByTimeAsync(30000);

    expect(fetchAssignments).toHaveBeenCalledTimes(3);
  });

  it("clears interval on unmount", async () => {
    const clearSpy = vi.spyOn(global, "clearInterval");
    const { useAssignmentPolling, cleanup } = await loadHookWithMockedReact();

    useAssignmentPolling(vi.fn().mockResolvedValue(undefined));
    cleanup();

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it("manual refresh calls fetchAssignments immediately", async () => {
    const { useAssignmentPolling } = await loadHookWithMockedReact();
    const fetchAssignments = vi.fn().mockResolvedValue(undefined);

    const { manualRefresh } = useAssignmentPolling(fetchAssignments);
    await manualRefresh();

    expect(fetchAssignments).toHaveBeenCalledTimes(2);
  });

  it("polling failure does not throw or crash", async () => {
    const { useAssignmentPolling } = await loadHookWithMockedReact();
    const fetchAssignments = vi.fn().mockRejectedValue(new Error("network"));

    const { manualRefresh } = useAssignmentPolling(fetchAssignments);
    await expect(manualRefresh()).resolves.toBeUndefined();
  });

  it("is disabled when enabled=false", async () => {
    const { useAssignmentPolling } = await loadHookWithMockedReact();
    const fetchAssignments = vi.fn().mockResolvedValue(undefined);

    useAssignmentPolling(fetchAssignments, { enabled: false });
    await vi.advanceTimersByTimeAsync(30000);

    expect(fetchAssignments).not.toHaveBeenCalled();
  });
});
