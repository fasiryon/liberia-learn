import { afterEach, describe, expect, it, vi } from "vitest";
import { loadV4Preview, v4ReviewCatalogue } from "@/lib/curriculum/v4/preview";
import { loadFactoryReview } from "@/lib/curriculum/v4/factoryReview";
import { cpSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

const draftRoot = "curriculum/factory-v4/drafts/4.0.0-draft.4";
const key = "g7-math-area-perimeter", selection = `factory@4.0.0-draft.4@${key}`;
afterEach(() => vi.restoreAllMocks());
function copyPackage() {
 const root = mkdtempSync(path.join(tmpdir(), "r7-review-"));
 cpSync(draftRoot, path.join(root, draftRoot), { recursive: true });
 cpSync("curriculum/factory-v4/reference-inputs.json", path.join(root, "curriculum/factory-v4/reference-inputs.json"));
 return root;
}
describe("factory review source selection", () => {
 it("serves exact generated projections for both immutable versions", () => {
  for (const version of ["4.0.0-draft.4", "4.0.0-draft.5"]) {
   const loaded = loadV4Preview(`factory@${version}@${key}`);
   expect(loaded.ok).toBe(true);
   if (loaded.ok === true) {
    expect(loaded.experience).toEqual(JSON.parse(readFileSync(`curriculum/factory-v4/drafts/${version}/${key}/learner-projection.json`, "utf8")));
    expect(loaded.entry.candidateVersion).toBe(version);
    expect(loaded.entry.origin).toBe("FACTORY_GENERATED");
   }
  }
 });
 it.each(["factory", "factory@g7-math-area-perimeter", "factory@latest@g7-math-area-perimeter", "factory@4.0.0-draft.4@unknown", "factory@4.0.0-draft.4@../g7-math-area-perimeter", " factory@4.0.0-draft.4@g7-math-area-perimeter", "factory@4.0.0-draft.4@g7-math-area-perimeter "])("rejects %s without substitution", selection => {
  expect(loadV4Preview(selection).ok).toBe(false);
 });
 it.each(["candidate.json", "learner-projection.json", "manifest.json", "factory-receipt.json", "visual-teaching.json", "paper-alternative.txt", "blueprint.json", "factory-artifact.json"])("rejects one-byte tampering of %s", name => {
  const root = copyPackage(), file = path.join(root, draftRoot, key, name);
  writeFileSync(file, readFileSync(file, "utf8") + " ");
  expect(() => loadFactoryReview(selection, root)).toThrow(/factory_review_/);
  vi.spyOn(process, "cwd").mockReturnValue(root);
  expect(loadV4Preview(selection).ok).toBe(false);
 });
 it("rejects a rewritten receipt even when a malicious manifest has new hashes", () => {
  const root = copyPackage(), file = path.join(root, draftRoot, "generation-receipt.json");
  writeFileSync(file, readFileSync(file, "utf8") + " ");
  expect(() => loadFactoryReview(selection, root)).toThrow("factory_review_receipt_hash");
 });
 it("rejects missing package files", () => {
  const root = copyPackage();
  unlinkSync(path.join(root, draftRoot, key, "paper-alternative.txt"));
  expect(() => loadFactoryReview(selection, root)).toThrow("factory_review_incomplete_package");
 });
 it("lists both sources separately with eight exact factory and six reference selections", () => {
  const catalogue = v4ReviewCatalogue();
  expect(catalogue.rejected).toEqual([]);
  expect(catalogue.entries.filter(e => e.origin === "FACTORY_GENERATED")).toHaveLength(8);
  expect(catalogue.entries.filter(e => e.origin === "HAND_AUTHORED_FIXTURE")).toHaveLength(6);
  expect(new Set(catalogue.entries.map(e => e.selection)).size).toBe(14);
 });
});
