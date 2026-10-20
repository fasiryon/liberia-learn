import {readFileSync} from "fs";
import {describe, expect, it} from "vitest";
import baseline from "@/curriculum/factory-v2/first-ten-baseline.json";
import adoption from "@/curriculum/factory-v2/contract-adoption-v1.json";
import {FIRST_TEN_AUTHORITY, readPinnedFirstTenSpec, verifyFirstTenContractFiles, type ContractFiles} from "@/lib/content-factory/v2/firstTenContract";
import {validateAuthoringInput} from "@/lib/content-factory/v2/authoringInput";

const root = "curriculum/factory-v2/contracts/1.0.0";
const files = (): ContractFiles => ({baseline: structuredClone(baseline), adoption: structuredClone(adoption), specBytes: readFileSync(`${root}/spec.json`), manifestBytes: readFileSync(`${root}/manifest.json`), bindingsBytes: readFileSync(`${root}/source-bindings.json`), erratumBytes: readFileSync(`${root}/FIRST_TEN_HANDOFF_V1.md`)});
describe("explicit first-ten contract adoption", () => {
  it("loads the unchanged 1.0.0 bytes and preserves the ten exact source bindings", () => {
    const input = files();
    expect(readPinnedFirstTenSpec()).toEqual(input.specBytes);
    const old = JSON.parse(readFileSync("curriculum/factory-v2/contracts/0.1.0/first-ten-baseline.json", "utf8"));
    expect(baseline.lessons).toEqual(old.lessons);
    expect(baseline.sourceCommit).toBe(FIRST_TEN_AUTHORITY.commit);
    expect(adoption.erratum).toMatchObject({id: "E1", policyId: "ll-aep-001-retention-pilot", policyVersion: "1.0.0"});
    const requirements = JSON.parse(readFileSync("curriculum/factory-v2/authoring/first-three/requirements.json", "utf8"));
    expect(requirements.lessons.every((lesson: any) => lesson.misconceptions.every((m: any) => m.misconceptionId.startsWith("mc-")))).toBe(true);
  });
  it.each(["specBytes", "manifestBytes", "bindingsBytes", "erratumBytes"] as const)("refuses tampered %s", key => {
    const input = files(); input[key] = Buffer.concat([input[key], Buffer.from(" ")]);
    expect(() => verifyFirstTenContractFiles(input)).toThrow();
  });
  it("refuses a silent source revision change and a stale baseline pin", () => {
    const input = files(); input.baseline.lessons[0].revisionId = "changed";
    expect(() => verifyFirstTenContractFiles(input)).toThrow("first_ten_adoption_cohort_changed");
    const stale = files(); stale.baseline.sourceCommit = adoption.previous.contractCommit;
    expect(() => verifyFirstTenContractFiles(stale)).toThrow("first_ten_contract_adoption_pin_mismatch");
  });
  it("refuses changed retention policy and approval through adoption metadata", () => {
    const input = files(); input.adoption.erratum.policyVersion = "2.0.0";
    expect(() => verifyFirstTenContractFiles(input)).toThrow("first_ten_erratum_or_binding_pin_mismatch");
    const approved = files(); approved.adoption.approved = true;
    expect(() => verifyFirstTenContractFiles(approved)).toThrow("first_ten_adoption_cannot_grant_authority");
  });
  it.each(["wk_mca7a_fri_p4", "wk_mca7a_fri_p3", "lesson_mca_1"])("keeps %s old input distinct and validates its new empty template", id => {
    const old = JSON.parse(readFileSync(`curriculum/factory-v2/contracts/0.1.0/authoring/first-three/${id}.input-template.json`, "utf8"));
    expect(() => validateAuthoringInput(old, "template")).toThrow("authoring_cohort_commit_mismatch");
    old.cohortCommit = FIRST_TEN_AUTHORITY.commit;
    expect(() => validateAuthoringInput(old, "template")).toThrow("authoring_contract_blueprint_pin_mismatch");
    const current = JSON.parse(readFileSync(`curriculum/factory-v2/authoring/first-three/${id}.input-template.json`, "utf8"));
    expect(current.blueprint.version).toBe("0.2.0");
    expect(current.resources.every((r: {payload: unknown}) => r.payload === null)).toBe(true);
    expect(validateAuthoringInput(current, "template").valid).toBe(true);
  });
});
