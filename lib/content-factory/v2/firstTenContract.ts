import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import baseline from "@/curriculum/factory-v2/first-ten-baseline.json";
import adoption from "@/curriculum/factory-v2/contract-adoption-v1.json";

export const FIRST_TEN_AUTHORITY = Object.freeze({
  commit: "ac196397cb13bd6866879c9f5c24503e5195c61d",
  contractVersion: "liberialearn-first-ten-modernization-contract/1.0.0",
  specSha256: "648ec61a72e2ddff147444dadae75aff321866cfc660498a792b6a3b48e7a28b",
  manifestSha256: "4cb6fb5588f5f840fe8b702f181a051a5838b093c1db82b0ea14d9c4b64ea549",
  erratumCommit: "d640b6fcb9e102b0a06a9d49a136a0aca6948a8f",
  erratumDocumentSha256: "18b4b4b1f2094c3bfae15064d9a5ce4eef9b72f11a838d626be54dd0853f8701",
});
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export type ContractFiles = { baseline: typeof baseline; adoption: typeof adoption; specBytes: Buffer; manifestBytes: Buffer; bindingsBytes: Buffer; erratumBytes: Buffer };

/** Pin integrity and source identity only. Never approval, publication or live-currentness evidence. */
export function verifyFirstTenContractFiles(files: ContractFiles): Buffer {
  const { baseline: b, adoption: a } = files;
  if (b.sourceCommit !== FIRST_TEN_AUTHORITY.commit || b.contractVersion !== FIRST_TEN_AUTHORITY.contractVersion || b.specSha256 !== FIRST_TEN_AUTHORITY.specSha256 || b.manifestSha256 !== FIRST_TEN_AUTHORITY.manifestSha256 || a.contractCommit !== b.sourceCommit || a.contractVersion !== b.contractVersion || a.specSha256 !== b.specSha256 || a.manifestSha256 !== b.manifestSha256) throw new Error("first_ten_contract_adoption_pin_mismatch");
  if (sha(files.specBytes) !== b.specSha256 || sha(files.manifestBytes) !== b.manifestSha256) throw new Error("first_ten_authoritative_contract_bytes_changed");
  const manifest = JSON.parse(files.manifestBytes.toString("utf8"));
  for (const [file, bytes] of [["spec.json", files.specBytes], ["source-bindings.json", files.bindingsBytes]] as const) {
    if (manifest.files.find((entry: {path: string}) => entry.path === `curriculum/modernization/v1/first-ten/${file}`)?.sha256 !== sha(bytes)) throw new Error("first_ten_manifest_file_mismatch");
  }
  if (a.sourceBindingsSha256 !== sha(files.bindingsBytes) || a.erratum.id !== "E1" || a.erratum.commit !== FIRST_TEN_AUTHORITY.erratumCommit || a.erratum.statusSource !== "git:dd8568500:lib/assessment/v2/retention.ts" || a.erratum.policyId !== "ll-aep-001-retention-pilot" || a.erratum.policyVersion !== "1.0.0" || a.erratum.documentSha256 !== FIRST_TEN_AUTHORITY.erratumDocumentSha256 || sha(files.erratumBytes) !== FIRST_TEN_AUTHORITY.erratumDocumentSha256) throw new Error("first_ten_erratum_or_binding_pin_mismatch");
  const bindings = JSON.parse(files.bindingsBytes.toString("utf8")).bindings;
  const spec = JSON.parse(files.specBytes.toString("utf8"));
  if (b.extractSha256 !== spec.basis.inventory.extractSha256 || a.authoredInputPolicy !== "NO_IMPLICIT_REPIN_REQUIRE_NEW_COHORT_INPUT" || a.previous.contractCommit !== "9628d97f6932ae4c0c399ec15455230e3f76607e" || a.previous.specSha256 !== "9b0128d725b83dc8ca6aaad818530b35c0649297fa7564b8fae8fb53a6d00964") throw new Error("first_ten_adoption_lineage_changed");
  if (b.lessons.length !== 10 || bindings.length !== 10 || spec.lessons.length !== 10) throw new Error("first_ten_adoption_cohort_changed");
  b.lessons.forEach((lesson, i) => {
    const source = bindings[i].source;
    const contract = spec.lessons[i];
    if (lesson.key !== bindings[i].key || lesson.key !== contract.key || lesson.databaseId !== source.databaseId || lesson.contentId !== source.contentId || lesson.revisionId !== source.revisionId || source.revisionNumber !== 1 || lesson.snapshotSha256 !== source.snapshotSha256 || lesson.grade !== contract.grade || lesson.subject !== contract.subject) throw new Error("first_ten_adoption_cohort_changed");
  });
  if (a.approved !== false || a.published !== false || a.released !== false) throw new Error("first_ten_adoption_cannot_grant_authority");
  return files.specBytes;
}

export function readPinnedFirstTenSpec(): Buffer {
  const root = path.join(process.cwd(), "curriculum/factory-v2/contracts/1.0.0");
  return verifyFirstTenContractFiles({ baseline, adoption, specBytes: fs.readFileSync(path.join(root, "spec.json")), manifestBytes: fs.readFileSync(path.join(root, "manifest.json")), bindingsBytes: fs.readFileSync(path.join(root, "source-bindings.json")), erratumBytes: fs.readFileSync(path.join(root, "FIRST_TEN_HANDOFF_V1.md")) });
}
