import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  LIBERIAN_COUNTIES,
} from "@/lib/school-operations";

describe("school operations helpers", () => {
  it("includes all 15 Liberian counties for school enrollment", () => {
    expect(LIBERIAN_COUNTIES).toHaveLength(15);
    expect(LIBERIAN_COUNTIES).toContain("Montserrado");
    expect(LIBERIAN_COUNTIES).toContain("River Gee");
  });

  it("generates cryptographically random 8-character temporary passwords", () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(8);
    expect(password).toMatch(/^[A-Za-z0-9]+$/);
  });
});
