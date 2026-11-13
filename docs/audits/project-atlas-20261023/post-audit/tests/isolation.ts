import { afterEach, vi } from "vitest";

// Every persistence/provider boundary used by these tests is mocked per suite.
// Deny accidental fetch calls as an additional safeguard. No real account login.
vi.stubGlobal("fetch", vi.fn(() => {
  throw new Error("Atlas synthetic tests prohibit network access");
}));
afterEach(() => vi.clearAllMocks());
