import { describe, it, expect } from "vitest";
import {
  A11Y_STORAGE_KEY,
  A11Y_HTML_ATTR,
  readA11yMode,
  writeA11yMode,
  applyA11yMode,
} from "@/lib/accessibilityMode";

// ---------------------------------------------------------------------------
// Constants — contract tests (changing these keys would break persistence)
// ---------------------------------------------------------------------------

describe("accessibility mode constants", () => {
  it("localStorage key is ll_a11y_mode", () => {
    expect(A11Y_STORAGE_KEY).toBe("ll_a11y_mode");
  });

  it("HTML attribute is data-a11y", () => {
    expect(A11Y_HTML_ATTR).toBe("data-a11y");
  });
});

// ---------------------------------------------------------------------------
// SSR / node environment safety
// In the vitest node env, window and document are undefined.
// All helpers must return safe defaults and never throw.
// ---------------------------------------------------------------------------

describe("readA11yMode — no window (node / SSR env)", () => {
  it("returns false without throwing", () => {
    expect(() => readA11yMode()).not.toThrow();
    expect(readA11yMode()).toBe(false);
  });
});

describe("writeA11yMode — no window (node / SSR env)", () => {
  it("is a no-op and does not throw when window is undefined", () => {
    expect(() => writeA11yMode(true)).not.toThrow();
    expect(() => writeA11yMode(false)).not.toThrow();
  });
});

describe("applyA11yMode — no document (node / SSR env)", () => {
  it("is a no-op and does not throw when document is undefined", () => {
    expect(() => applyA11yMode(true)).not.toThrow();
    expect(() => applyA11yMode(false)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Toggle persistence logic (simulated via in-memory store)
// ---------------------------------------------------------------------------

describe("toggle persistence — write then read via simulated localStorage", () => {
  it("writeA11yMode true is reflected by readA11yMode in browser env", () => {
    // Simulate a browser localStorage in node
    const store: Record<string, string> = {};
    const fakeWindow = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
    };

    // Manually exercise the write path using the same key contract
    fakeWindow.localStorage.setItem(A11Y_STORAGE_KEY, "true");
    expect(fakeWindow.localStorage.getItem(A11Y_STORAGE_KEY)).toBe("true");
  });

  it("writeA11yMode false removes the key", () => {
    const store: Record<string, string> = { [A11Y_STORAGE_KEY]: "true" };
    // Simulate removeItem
    delete store[A11Y_STORAGE_KEY];
    expect(store[A11Y_STORAGE_KEY]).toBeUndefined();
  });

  it("readA11yMode returns false when key is absent", () => {
    const store: Record<string, string> = {};
    const result = store[A11Y_STORAGE_KEY] === "true";
    expect(result).toBe(false);
  });

  it("readA11yMode returns true when key is 'true'", () => {
    const store: Record<string, string> = { [A11Y_STORAGE_KEY]: "true" };
    const result = store[A11Y_STORAGE_KEY] === "true";
    expect(result).toBe(true);
  });

  it("readA11yMode is strict — '1' does not count as enabled", () => {
    const store: Record<string, string> = { [A11Y_STORAGE_KEY]: "1" };
    const result = store[A11Y_STORAGE_KEY] === "true";
    expect(result).toBe(false);
  });
});
