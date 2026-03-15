import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const registerMock = vi.fn();
const syncRegisterMock = vi.fn();

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useEffect: (callback: () => void | (() => void)) => {
      callback();
    },
  };
});

describe("ServiceWorkerRegistration", () => {
  beforeEach(() => {
    if (!('navigator' in globalThis)) {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        writable: true,
        value: undefined,
      });
    }
  });
  afterEach(() => {
    registerMock.mockReset();
    syncRegisterMock.mockReset();
    delete (globalThis as { navigator?: Navigator }).navigator;
  });

  it("renders without error when service workers are unavailable", async () => {
    const { ServiceWorkerRegistration } = await import("@/components/ServiceWorkerRegistration");

    expect(() => renderToStaticMarkup(<ServiceWorkerRegistration />)).not.toThrow();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("attempts registration when service workers are supported", async () => {
    registerMock.mockResolvedValue({
      sync: {
        register: syncRegisterMock,
      },
    });
    syncRegisterMock.mockResolvedValue(undefined);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          register: registerMock,
        },
      },
    });

    const { ServiceWorkerRegistration } = await import("@/components/ServiceWorkerRegistration");

    renderToStaticMarkup(<ServiceWorkerRegistration />);

    await Promise.resolve();

    expect(registerMock).toHaveBeenCalledWith("/sw.js");
    expect(syncRegisterMock).toHaveBeenCalledWith("liberialearn-sync");
  });
});
