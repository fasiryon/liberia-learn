import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();
const isAgentEnabled = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    agentControl: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      upsert: (...a: unknown[]) => upsert(...a),
    },
  },
}));
vi.mock("@/lib/agents/flags", () => ({
  isAgentEnabled: (...a: unknown[]) => isAgentEnabled(...a),
}));

import { resolveAgentEnabled, setAgentControl } from "@/lib/agents/control";

describe("resolveAgentEnabled", () => {
  beforeEach(() => {
    findUnique.mockReset();
    isAgentEnabled.mockReset();
  });

  it("uses a true override even when the env flag is off", async () => {
    findUnique.mockResolvedValue({ enabledOverride: true });
    isAgentEnabled.mockReturnValue(false);
    expect(await resolveAgentEnabled("echo", "AGENT_ECHO_ENABLED")).toBe(true);
    expect(isAgentEnabled).not.toHaveBeenCalled();
  });

  it("uses a false override even when the env flag is on", async () => {
    findUnique.mockResolvedValue({ enabledOverride: false });
    isAgentEnabled.mockReturnValue(true);
    expect(await resolveAgentEnabled("echo", "AGENT_ECHO_ENABLED")).toBe(false);
  });

  it("falls back to the env flag when the override is null", async () => {
    findUnique.mockResolvedValue({ enabledOverride: null });
    isAgentEnabled.mockReturnValue(true);
    expect(await resolveAgentEnabled("echo", "AGENT_ECHO_ENABLED")).toBe(true);
  });

  it("falls back to the env flag when no control row exists", async () => {
    findUnique.mockResolvedValue(null);
    isAgentEnabled.mockReturnValue(false);
    expect(await resolveAgentEnabled("echo", "AGENT_ECHO_ENABLED")).toBe(false);
  });

  it("falls back to the env flag if the control lookup throws", async () => {
    findUnique.mockRejectedValueOnce(new Error("db down"));
    isAgentEnabled.mockReturnValue(true);
    expect(await resolveAgentEnabled("echo", "AGENT_ECHO_ENABLED")).toBe(true);
  });
});

describe("setAgentControl", () => {
  beforeEach(() => upsert.mockReset());
  it("upserts the override with the actor", async () => {
    upsert.mockResolvedValue({});
    await setAgentControl("echo", false, "admin-1");
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ agentName: "echo" });
    expect(arg.create).toMatchObject({ agentName: "echo", enabledOverride: false, updatedBy: "admin-1" });
    expect(arg.update).toMatchObject({ enabledOverride: false, updatedBy: "admin-1" });
  });
});
