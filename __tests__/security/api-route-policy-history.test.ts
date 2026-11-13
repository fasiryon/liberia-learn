import {describe, expect, it, vi} from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(() => {throw new Error("required Git baseline is unavailable");}),
}));

import {changedApiRoutes} from "@/scripts/audit-api-route-policies.mjs";

describe("route policy audit history boundary", () => {
  it("fails rather than treating unavailable Git history as an empty set of changed routes", () => {
    expect(() => changedApiRoutes()).toThrow("api_route_policy_git_history_unavailable");
  });
});
