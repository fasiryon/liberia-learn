/**
 * Sprint 15: Low-bandwidth mode unit tests
 * Tests lib/lowBandwidthMode.ts using Node-safe stubs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Node.js has no navigator/localStorage — stub them
const mockStorage = new Map<string, string>();
const mockListeners: Set<Function> = new Set();

const mockConnection = {
  effectiveType: "4g" as string,
  downlink: 10,
  addEventListener: vi.fn((event: string, cb: Function) => {
    if (event === "change") mockListeners.add(cb);
  }),
};

vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => { mockStorage.set(key, value); },
  removeItem: (key: string) => { mockStorage.delete(key); },
});

vi.stubGlobal("navigator", {
  connection: mockConnection,
});

vi.stubGlobal("document", {
  documentElement: {
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
  },
});

// Dynamic import after stubs are set up
async function freshModule() {
  vi.resetModules();
  return import("@/lib/lowBandwidthMode");
}

describe("getLowBandwidthMode", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockConnection.effectiveType = "4g";
    mockConnection.downlink = 10;
  });

  it("returns false on a good 4G connection with no override", async () => {
    const { getLowBandwidthMode } = await freshModule();
    expect(getLowBandwidthMode()).toBe(false);
  });

  it("returns true on a 2G connection with no override", async () => {
    mockConnection.effectiveType = "2g";
    const { getLowBandwidthMode } = await freshModule();
    expect(getLowBandwidthMode()).toBe(true);
  });

  it("returns true when downlink is below 0.5", async () => {
    mockConnection.effectiveType = "4g";
    mockConnection.downlink = 0.3;
    const { getLowBandwidthMode } = await freshModule();
    expect(getLowBandwidthMode()).toBe(true);
  });

  it("returns true when localStorage override is '1'", async () => {
    mockStorage.set("llbm", "1");
    const { getLowBandwidthMode } = await freshModule();
    expect(getLowBandwidthMode()).toBe(true);
  });

  it("returns false when localStorage override is '0' even on 2G", async () => {
    mockConnection.effectiveType = "2g";
    mockStorage.set("llbm", "0");
    const { getLowBandwidthMode } = await freshModule();
    expect(getLowBandwidthMode()).toBe(false);
  });
});

describe("setLowBandwidthMode", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockConnection.effectiveType = "4g";
    mockConnection.downlink = 10;
    vi.mocked(document.documentElement.setAttribute).mockClear();
    vi.mocked(document.documentElement.removeAttribute).mockClear();
  });

  it("stores '1' in localStorage when enabled", async () => {
    const { setLowBandwidthMode } = await freshModule();
    setLowBandwidthMode(true);
    expect(mockStorage.get("llbm")).toBe("1");
  });

  it("stores '0' in localStorage when disabled", async () => {
    const { setLowBandwidthMode } = await freshModule();
    setLowBandwidthMode(false);
    expect(mockStorage.get("llbm")).toBe("0");
  });
});

describe("clearLowBandwidthOverride", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockConnection.effectiveType = "4g";
    mockConnection.downlink = 10;
  });

  it("removes the localStorage key", async () => {
    const { setLowBandwidthMode, clearLowBandwidthOverride } = await freshModule();
    setLowBandwidthMode(true);
    expect(mockStorage.has("llbm")).toBe(true);
    clearLowBandwidthOverride();
    expect(mockStorage.has("llbm")).toBe(false);
  });
});

describe("subscribeLowBandwidth", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockConnection.effectiveType = "4g";
    mockConnection.downlink = 10;
  });

  it("calls subscriber when setLowBandwidthMode is called", async () => {
    const { setLowBandwidthMode, subscribeLowBandwidth } = await freshModule();
    const cb = vi.fn();
    const unsub = subscribeLowBandwidth(cb);
    setLowBandwidthMode(true);
    expect(cb).toHaveBeenCalledWith(true);
    unsub();
    setLowBandwidthMode(false);
    expect(cb).toHaveBeenCalledTimes(1); // not called after unsub
  });
});
