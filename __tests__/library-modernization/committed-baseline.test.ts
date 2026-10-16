// The committed Library Modernization V1 baseline: complete, consistent with its ledger, bound to exact
// revisions and free of learner, user and school identifiers. Runs from committed files only (no extract,
// no database), so it holds in CI.
import { readFileSync, readdirSync } from "fs";
import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { answerLedgerQuestions, readLedgerFile } from "@/lib/curriculum/modernization/ledger";
import { LEDGER_FILE, MODERNIZATION_DIR } from "@/lib/curriculum/modernization/build";

type InventoryFile = { extract: { lessons: number; extractSha256: string; transactionReadOnly: string }; lessons: { contentId: string; revision: { id: string | null; contentHash: string | null; hashVerified: boolean }; audit: { auditDigest: string; reviewOutcome: string }; classification: { track: string } }[] };
const inventory = JSON.parse(readFileSync(`${MODERNIZATION_DIR}/inventory.json`, "utf8")) as InventoryFile;
const ledger = readLedgerFile(LEDGER_FILE);

describe("committed baseline", () => {
  it("accounts for every lesson in the extract exactly once", () => {
    expect(inventory.lessons.length).toBe(inventory.extract.lessons);
    expect(new Set(inventory.lessons.map((lesson) => lesson.contentId)).size).toBe(inventory.lessons.length);
    expect(inventory.extract.transactionReadOnly).toBe("on");
  });
  it("binds every lesson to a verified exact revision", () => {
    for (const lesson of inventory.lessons) {
      expect(lesson.revision.id, lesson.contentId).toBeTruthy();
      expect(lesson.revision.contentHash, lesson.contentId).toMatch(/^[0-9a-f]{64}$/);
      expect(lesson.revision.hashVerified, lesson.contentId).toBe(true);
    }
  });
  it("matches the ledger: every lesson observed live at the audited revision with the audited digest", () => {
    expect(ledger.lessons.size).toBe(inventory.lessons.length);
    for (const lesson of inventory.lessons) {
      const state = ledger.lessons.get(lesson.contentId)!;
      expect(state.live?.revisionId).toBe(lesson.revision.id);
      expect(state.live?.contentHash).toBe(lesson.revision.contentHash);
      expect(state.audit?.auditDigest).toBe(lesson.audit.auditDigest);
      expect(state.audit?.stale).toBe(false);
      expect(state.track.proposed).toBe(lesson.classification.track);
    }
  });
  it("replays the ledger and matches the committed state answers", () => {
    const state = JSON.parse(readFileSync(`${MODERNIZATION_DIR}/ledger/state.json`, "utf8"));
    expect(state.head).toBe(ledger.head);
    expect(canonicalizeJson(state.answers)).toBe(canonicalizeJson(answerLedgerQuestions(ledger)));
  });
  it("claims no approval, release or learning outcome that the ledger does not record", () => {
    const answers = answerLedgerQuestions(ledger);
    expect(answers.approved).toEqual({ reviewAccepted: 0, releaseAuthorized: 0, released: 0 });
    expect(answers.demonstratedLearningSuccess).toBe(0);
    expect(inventory.lessons.some((lesson) => lesson.audit.reviewOutcome === "PASS_MECHANICAL_CHECKS")).toBe(false);
  });
  it("contains no learner, user, author or school identifiers", () => {
    const files = [`${MODERNIZATION_DIR}/inventory.json`, `${MODERNIZATION_DIR}/tracker.json`, LEDGER_FILE, ...readdirSync(`${MODERNIZATION_DIR}/audit`).map((file) => `${MODERNIZATION_DIR}/audit/${file}`)];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/"(studentId|userId|authorUserId|editedById|schoolId|classId|email|phone|guardianId)"\s*:/);
      expect(text, file).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    }
  });
});
