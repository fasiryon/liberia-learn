import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import os from "os"; import path from "path";
import { loadFactoryReview } from "@/lib/curriculum/v4/factoryReview";

const keys = ["g7-math-area-perimeter", "g7-civics-counties-capitals"];
function copyRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "cos-v4-tamper-"));
  cpSync("curriculum/factory-v4", path.join(root, "curriculum/factory-v4"), { recursive: true });
  return root;
}
describe("CoS independent tamper checks", () => {
  for (const version of ["4.0.0-draft.4", "4.0.0-draft.5"]) for (const key of keys) {
    it(`${version} ${key} loads from a clean copy`, () => {
      const root = copyRoot();
      try { expect(loadFactoryReview(`factory@${version}@${key}`, root).review.candidateVersion).toBe(version); } finally { rmSync(root, { recursive: true, force: true }); }
    });
    for (const file of ["candidate.json", "learner-projection.json", "visual-teaching.json", "manifest.json", "paper-alternative.txt"]) {
      it(`${version} ${key} rejects one flipped byte in ${file}`, () => {
        const root = copyRoot();
        try {
          const f = path.join(root, `curriculum/factory-v4/drafts/${version}/${key}/${file}`);
          const text = readFileSync(f, "utf8"); const i = Math.floor(text.length / 2);
          writeFileSync(f, text.slice(0, i) + (text[i] === "a" ? "b" : "a") + text.slice(i + 1));
          expect(() => loadFactoryReview(`factory@${version}@${key}`, root)).toThrow(/factory_review_/);
        } finally { rmSync(root, { recursive: true, force: true }); }
      });
    }
  }
  it("draft.5 projections carry their own version; draft.4 keeps its frozen stamp", () => {
    expect(loadFactoryReview("factory@4.0.0-draft.5@g7-math-area-perimeter").experience.version).toBe("4.0.0-draft.5");
    expect(JSON.parse(readFileSync("curriculum/factory-v4/drafts/4.0.0-draft.4/g7-math-area-perimeter/learner-projection.json", "utf8")).version).toBe("4.0.0-draft.1");
  });
});
